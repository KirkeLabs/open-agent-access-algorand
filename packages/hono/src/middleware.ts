import { readFile } from "node:fs/promises";
import type { Context, MiddlewareHandler, Next } from "hono";
import {
  appendReceipt,
  createReceiptId,
  createTraceId,
  decideAccess,
  hashCanonicalJson,
  hashPolicy,
  InMemoryRateLimiter,
  parseAgentAccessHeaders,
  validateAgentAccessPolicy,
  type AgentAccessPolicy,
  type ReceiptLedgerOptions,
  type ReceiptRecord
} from "@kirkelabs/open-agent-access-core";
import { verifyAgentAccessHeaders, type TrustedAgentKey } from "@kirkelabs/open-agent-access-identity";
import { evaluateStopSignal, validateAgentStopSignal } from "@kirkelabs/open-agent-access-incident";
import { parseAlgorandX402SettlementHeaders } from "@kirkelabs/open-agent-access-payments-algorand-x402";
import { buildDecisionHeaders, decisionStatus } from "./response.js";
import { createMemoryReplayStore, type ReplayStore } from "./replay.js";

export interface AgentAccessMiddlewareOptions {
  policyPath: string;
  policyUrl?: string;
  receipts?: ReceiptLedgerOptions;
  failMode?: "open" | "closed";
  replayCache?: {
    ttlMs?: number;
    maxEntries?: number;
  };
  replayStore?: ReplayStore;
  requireIdempotencyKeyForPaid?: boolean;
  emergencyStopPath?: string;
  agentIdentity?: {
    required?: boolean;
    trustedKeys?: TrustedAgentKey[];
    maxSkewMs?: number;
  };
  algorandX402?: {
    enabled?: boolean;
    payTo?: string;
    facilitatorUrl?: string;
    network?: string;
  };
}

const limiter = new InMemoryRateLimiter();
const paidRouteLocks = new Set<string>();

export function agentAccessMiddleware(options: AgentAccessMiddlewareOptions): MiddlewareHandler {
  let cachedPolicy: AgentAccessPolicy | undefined;
  let cachedHash: string | undefined;
  const replayStore = options.replayStore ?? createMemoryReplayStore({ maxEntries: options.replayCache?.maxEntries });

  async function loadPolicy() {
    if (!cachedPolicy) {
      const text = await readFile(options.policyPath, "utf8");
      cachedPolicy = validateAgentAccessPolicy(JSON.parse(text));
      cachedHash = hashPolicy(cachedPolicy);
    }
    return { policy: cachedPolicy, policyHash: cachedHash as string };
  }

  return async (c: Context, next: Next) => {
    setBaseSecurityHeaders(c);
    let loaded: { policy: AgentAccessPolicy; policyHash: string };
    try {
      loaded = await loadPolicy();
    } catch (error) {
      if (options.failMode === "open") {
        await next();
        return;
      }
      return c.json({ error: "agent_access_policy_unavailable", message: (error as Error).message }, 503);
    }

    const wellKnownPath = "/.well-known/agent-access.json";
    if (c.req.path === wellKnownPath) {
      c.header("content-type", "application/json");
      return c.json(loaded.policy);
    }

    const parsed = parseAgentAccessHeaders(c.req.raw.headers);
    const traceId = parsed?.traceId ?? createTraceId();
    const identityVerification = options.agentIdentity?.required
      ? verifyAgentAccessHeaders(c.req.raw.headers, {
        method: c.req.method,
        url: c.req.url,
        trustedKeys: options.agentIdentity.trustedKeys ?? [],
        maxSkewMs: options.agentIdentity.maxSkewMs
      })
      : undefined;
    if (identityVerification && !identityVerification.ok) {
      c.header("AA-Decision", "deny");
      c.header("AA-Trace-ID", traceId);
      c.header("AA-Agent-Identity-Verified", "false");
      c.header("AA-Agent-Identity-Reason", identityVerification.reason);
      return c.json({
        error: "agent_identity_unverified",
        reason: identityVerification.reason,
        traceId
      }, 401);
    }
    if (identityVerification?.ok) {
      c.header("AA-Agent-Identity-Verified", "true");
      c.header("AA-Agent-Key-ID", identityVerification.keyId ?? "");
    }
    const requestUrl = new URL(c.req.url);
    const policyUrl = options.policyUrl ?? `${requestUrl.origin}${wellKnownPath}`;
    const decision = decideAccess(loaded.policy, {
      url: c.req.url,
      method: c.req.method,
      purpose: parsed?.purpose,
      use: parsed?.use,
      budget: parsed?.budget,
      agent: parsed?.agent
    });
    if (options.emergencyStopPath) {
      const stopText = await readFile(options.emergencyStopPath, "utf8").catch(() => undefined);
      if (stopText) {
        const stop = evaluateStopSignal(validateAgentStopSignal(JSON.parse(stopText)), {
          agentId: parsed?.agent.id,
          purpose: parsed?.purpose,
          use: parsed?.use,
          ruleId: decision.rule?.id,
          path: requestUrl.pathname
        });
        if (stop.stopped) {
          c.header("AA-Decision", "throttle");
          c.header("AA-Trace-ID", traceId);
          c.header("AA-Emergency-Stop", "true");
          if (stop.retryAfter) c.header("Retry-After", String(stop.retryAfter));
          return c.json({ error: "agent_access_stopped", reason: stop.reason, contact: stop.contact, traceId }, 503);
        }
      }
    }

    const rateResult = decision.rateLimit
      ? limiter.check(`${parsed?.agent.id ?? requestUrl.hostname}:${decision.rule?.id ?? "default"}`, decision.rateLimit)
      : undefined;

    const finalDecision = rateResult && !rateResult.allowed ? { ...decision, decision: "throttle" as const, reason: "rate_limited" } : decision;
    const receiptId = createReceiptId();
    const headers = buildDecisionHeaders({
      decision: finalDecision.decision,
      policyRef: `${policyUrl}#${decision.rule?.id ?? "default"}`,
      traceId,
      rule: decision.rule,
      receiptId,
      rateLimitLimit: rateResult?.limit,
      rateLimitRemaining: rateResult?.remaining
    });

    headers.forEach((value, key) => c.header(key, value));
    c.header("AA-Policy-Hash", loaded.policyHash);
    c.header("AA-Payment-Resource", buildPaymentResourceBinding(c.req.method, c.req.url, loaded.policyHash, decision.rule?.id, traceId));
    if (rateResult?.retryAfter) {
      c.header("Retry-After", String(rateResult.retryAfter));
    }

    if (finalDecision.decision === "allow") {
      await writeSiteReceipt(options, loaded, c, parsed, finalDecision.decision, receiptId, rateResult);
      await next();
      return;
    }

    if (finalDecision.decision === "charge") {
      const paymentHeader = c.req.raw.headers.get("X-PAYMENT") ?? c.req.raw.headers.get("x-payment");
      const idempotencyKey = c.req.raw.headers.get("AA-Idempotency-Key") ?? c.req.raw.headers.get("Idempotency-Key") ?? traceId;
      const paidLockKey = `${c.req.method}:${c.req.url}:${decision.rule?.id ?? "default"}:${idempotencyKey}`;
      if (options.requireIdempotencyKeyForPaid && !c.req.raw.headers.get("AA-Idempotency-Key") && !c.req.raw.headers.get("Idempotency-Key")) {
        await writeSiteReceipt(options, loaded, c, parsed, "review", receiptId, rateResult, false, 428);
        return c.json({ error: "idempotency_key_required", decision: "review", ruleId: decision.rule?.id }, 428);
      }
      if (options.algorandX402?.enabled && paymentHeader) {
        const replayKey = buildReplayKey(paymentHeader, c.req.method, c.req.url, loaded.policyHash, decision.rule?.id);
        if (await isReplay(replayStore, replayKey)) {
          await writeSiteReceipt(options, loaded, c, parsed, "deny", receiptId, rateResult, false, 409);
          return c.json({ error: "payment_replay_detected", decision: "deny", ruleId: decision.rule?.id }, 409);
        }
        if (paidRouteLocks.has(paidLockKey)) {
          await writeSiteReceipt(options, loaded, c, parsed, "throttle", receiptId, rateResult, false, 409);
          return c.json({ error: "duplicate_paid_fulfilment_in_progress", decision: "throttle", ruleId: decision.rule?.id }, 409);
        }
        paidRouteLocks.add(paidLockKey);
        try {
          await next();
          await rememberReplay(replayStore, replayKey, options.replayCache);
          await writeSiteReceipt(options, loaded, c, parsed, "charge", receiptId, rateResult, true, c.res.status);
        } finally {
          paidRouteLocks.delete(paidLockKey);
        }
        return;
      }
      await writeSiteReceipt(options, loaded, c, parsed, "charge", receiptId, rateResult, false, 402);
      return c.json({
        error: "payment_required",
        decision: "charge",
        ruleId: decision.rule?.id,
        traceId,
        policyHash: loaded.policyHash,
        resource: buildPaymentResourceBinding(c.req.method, c.req.url, loaded.policyHash, decision.rule?.id, traceId),
        payment: {
          type: decision.rule?.payment?.type ?? "x402",
          settlement: decision.rule?.payment?.settlement ?? "algorand",
          network: decision.rule?.payment?.network ?? options.algorandX402?.network ?? "testnet",
          price: decision.rule?.price,
          facilitatorUrl: decision.rule?.payment?.facilitatorUrl ?? options.algorandX402?.facilitatorUrl,
          payTo: decision.rule?.payment?.payTo ?? options.algorandX402?.payTo
        }
      }, 402);
    }

    const status = decisionStatus(finalDecision.decision);
    await writeSiteReceipt(options, loaded, c, parsed, finalDecision.decision, receiptId, rateResult, false, status);
    return c.json({
      error: finalDecision.reason,
      decision: finalDecision.decision,
      ruleId: decision.rule?.id
    }, status as 403);
  };
}

function setBaseSecurityHeaders(c: Context) {
  c.header("Cache-Control", "no-store");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "no-referrer");
  c.header("Cross-Origin-Resource-Policy", "same-origin");
}

function buildPaymentResourceBinding(method: string, url: string, policyHash: string, ruleId: string | undefined, traceId: string) {
  return hashCanonicalJson({
    method: method.toUpperCase(),
    url,
    policyHash,
    ruleId,
    traceId
  });
}

function buildReplayKey(paymentHeader: string, method: string, url: string, policyHash: string, ruleId: string | undefined) {
  return hashCanonicalJson({
    paymentHeader,
    method: method.toUpperCase(),
    url,
    policyHash,
    ruleId
  });
}

async function isReplay(replayStore: ReplayStore, replayKey: string) {
  return replayStore.has(replayKey);
}

async function rememberReplay(replayStore: ReplayStore, replayKey: string, options: AgentAccessMiddlewareOptions["replayCache"]) {
  await replayStore.set(replayKey, options?.ttlMs ?? 10 * 60_000);
}

async function writeSiteReceipt(
  options: AgentAccessMiddlewareOptions,
  loaded: { policy: AgentAccessPolicy; policyHash: string },
  c: Context,
  parsed: ReturnType<typeof parseAgentAccessHeaders>,
  decision: ReceiptRecord["policy"] extends infer P ? P extends { decision?: infer D } ? D : never : never,
  receiptId: string,
  rateResult?: { limit: number; remaining: number; retryAfter?: number },
  settlementSuccess?: boolean,
  status?: number
) {
  if (!options.receipts) {
    return;
  }
  const matched = decideAccess(loaded.policy, {
    url: c.req.url,
    method: c.req.method,
    purpose: parsed?.purpose,
    use: parsed?.use,
    budget: parsed?.budget,
    agent: parsed?.agent
  });
  const settlement = parseAlgorandX402SettlementHeaders(c.req.raw.headers);
  await appendReceipt(options.receipts.path, {
    receiptVersion: "0.1",
    receiptType: "agent_access",
    role: "site",
    traceId: parsed?.traceId ?? c.res.headers.get("AA-Trace-ID") ?? createTraceId(),
    receiptId,
    method: c.req.method,
    url: c.req.url,
    origin: new URL(c.req.url).origin,
    agent: parsed?.agent,
    declared: {
      purpose: parsed?.purpose,
      use: parsed?.use,
      budget: parsed?.budget
    },
    policy: {
      url: options.policyUrl,
      ruleId: matched.rule?.id,
      policyHash: loaded.policyHash,
      decision: decision as ReceiptRecord["policy"] extends { decision?: infer D } ? D : never
    },
    rate: {
      limit: rateResult?.limit,
      remaining: rateResult?.remaining,
      retryAfter: rateResult?.retryAfter
    },
    payment: {
      required: matched.decision === "charge",
      type: matched.rule?.payment?.type,
      settlement: matched.rule?.payment?.settlement,
      network: matched.rule?.payment?.network ?? options.algorandX402?.network,
      asset: matched.rule?.payment?.asset,
      price: matched.rule?.price,
      facilitatorUrl: matched.rule?.payment?.facilitatorUrl ?? options.algorandX402?.facilitatorUrl,
      transactionId: settlement.transactionId,
      payer: settlement.payer,
      payTo: matched.rule?.payment?.payTo ?? options.algorandX402?.payTo,
      settlementSuccess: settlementSuccess ?? settlement.settlementSuccess
    },
    response: {
      status
    }
  });
}
