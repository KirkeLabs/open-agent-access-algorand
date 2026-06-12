import {
  appendReceipt,
  appendAccessEvent,
  buildAgentAccessHeaders,
  buildSiteDecisionHeaders,
  createAccessEvent,
  decideAccess,
  pathMatches,
  readReceiptLedger,
  validateAgentAccessPolicy,
  verifyAccessEventTrail,
  verifyReceiptChain,
  type AgentAccessPolicy
} from "@open-agent-access/core";
import { evaluateMandate, validateMandateDocument, type MandateDocument } from "@open-agent-access/mandates";
import {
  createAlgorandX402PaymentRequiredFixture,
  parseAlgorandX402SettlementHeaders
} from "@open-agent-access/payments-algorand-x402";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface ConformanceCheck {
  id: string;
  ok: boolean;
  message: string;
}

export interface ConformanceResult {
  ok: boolean;
  checks: ConformanceCheck[];
}

const fixturePolicy: AgentAccessPolicy = {
  version: "0.1",
  protocol: "open-agent-access",
  site: {
    name: "Conformance Fixture",
    origin: "https://conformance.example",
    contact: "mailto:agents@conformance.example",
    securityContact: "mailto:security@conformance.example",
    terms: "https://conformance.example/agent-terms"
  },
  defaults: {
    decision: "review",
    respectRobotsTxt: true,
    requireAgentIdentity: true,
    requirePurpose: true,
    requireReceipt: true
  },
  rules: [
    {
      id: "docs",
      match: { methods: ["GET"], paths: ["/docs/**"] },
      decision: "allow",
      purposes: ["research"],
      uses: ["read", "summarize"],
      deniedUses: ["ai-train"],
      rateLimit: { requests: 60, window: "1m", burst: 10, respectRetryAfter: true },
      attribution: { required: true, format: "source-url" },
      retention: { maxAge: "30d", allowEmbedding: false }
    },
    {
      id: "paid",
      match: { methods: ["GET"], paths: ["/premium/**"] },
      decision: "charge",
      purposes: ["research"],
      uses: ["ai-input"],
      deniedUses: ["ai-train"],
      price: { amount: "0.005", currency: "USD", unit: "request" },
      payment: { type: "x402", settlement: "algorand", network: "testnet", scheme: "exact", asset: "USDC" },
      rateLimit: { requests: 30, window: "1m", burst: 5, respectRetryAfter: true },
      receipt: { required: true }
    }
  ]
};

const fixtureMandates: MandateDocument = {
  version: "0.1",
  protocol: "open-agent-access",
  kind: "agent-mandates",
  issuer: { name: "Conformance Fixture", origin: "https://conformance.example" },
  mandates: [
    {
      id: "agent-docs-read",
      subject: { agentId: "did:web:agent.example", principal: "user:conformance@example" },
      delegator: { id: "user:conformance@example" },
      scope: {
        purposes: ["research"],
        uses: ["read"],
        methods: ["GET"],
        resources: ["https://conformance.example/docs/**"],
        tools: ["fetch"],
        consequenceClasses: ["public-read"],
        maxBudget: { amount: "0.05", currency: "USD" }
      },
      expiresAt: "2099-01-01T00:00:00.000Z",
      evidence: {
        events: ["mandate_evaluated", "policy_decision"],
        receiptRequired: true,
        policyHashRequired: true
      }
    }
  ]
};

export async function runConformanceSuite(): Promise<ConformanceResult> {
  const checks: ConformanceCheck[] = [];
  await check("policy-v0.1.valid-policy", checks, () => validateAgentAccessPolicy(fixturePolicy).rules.length === 2);
  await check("paths-v0.1.double-star", checks, () => pathMatches("/docs/**", "/docs/reference/page"));
  await check("decisions-v0.1.allow", checks, () => decideAccess(fixturePolicy, {
    url: "https://conformance.example/docs/page",
    method: "GET",
    purpose: "research",
    use: "read",
    agent: { id: "did:web:agent.example" }
  }).decision === "allow");
  await check("decisions-v0.1.charge", checks, () => decideAccess(fixturePolicy, {
    url: "https://conformance.example/premium/report",
    method: "GET",
    purpose: "research",
    use: "ai-input",
    agent: { id: "did:web:agent.example" }
  }).decision === "charge");
  await check("headers-v0.1.agent-and-site", checks, () => {
    const agent = buildAgentAccessHeaders({
      agent: { id: "did:web:agent.example", name: "Agent" },
      purpose: "research",
      use: "read",
      traceId: "trace"
    });
    const site = buildSiteDecisionHeaders({ decision: "allow", traceId: "trace", receiptId: "receipt" });
    return agent.get("AA-Protocol-Version") === "0.1" && site.get("AA-Decision") === "allow";
  });
  await check("mandates-v0.1.fail-closed", checks, () => {
    const mandates = validateMandateDocument(fixtureMandates);
    const allowed = evaluateMandate(mandates, {
      agentId: "did:web:agent.example",
      principal: "user:conformance@example",
      purpose: "research",
      use: "read",
      method: "GET",
      url: "https://conformance.example/docs/page",
      tool: "fetch",
      consequence: "public-read",
      now: new Date("2026-06-12T00:00:00.000Z")
    });
    const denied = evaluateMandate(mandates, {
      agentId: "did:web:agent.example",
      principal: "user:conformance@example",
      purpose: "research",
      use: "read",
      method: "GET",
      url: "https://evil.example/docs/page",
      tool: "fetch",
      consequence: "public-read",
      now: new Date("2026-06-12T00:00:00.000Z")
    });
    return allowed.decision === "allow" && denied.decision === "deny";
  });
  await check("events-v0.1.hash-chain", checks, () => {
    const events = appendAccessEvent([
      createAccessEvent({ traceId: "trace", type: "mandate_evaluated", actor: { role: "agent", id: "did:web:agent.example" } })
    ], {
      traceId: "trace",
      type: "policy_decision",
      actor: { role: "site", id: "https://conformance.example" },
      policy: { ruleId: "docs", decision: "allow" }
    });
    return verifyAccessEventTrail(events).valid;
  });
  await check("receipts-v0.1.hash-chain", checks, async () => {
    const dir = await mkdtemp(join(tmpdir(), "oaa-conformance-"));
    const ledger = join(dir, "receipts.jsonl");
    await appendReceipt(ledger, {
      receiptVersion: "0.1",
      receiptType: "agent_access",
      role: "agent",
      traceId: "trace",
      method: "GET",
      url: "https://conformance.example/docs/page",
      origin: "https://conformance.example",
      payment: { required: false }
    });
    return (await verifyReceiptChain(ledger)).valid && (await readReceiptLedger(ledger)).length === 1;
  });
  await check("algorand-x402-profile-v0.1.payment-required", checks, () => {
    const fixture = createAlgorandX402PaymentRequiredFixture();
    return fixture.status === 402 && fixture.body.payment.settlement === "algorand" && fixture.body.payment.network === "testnet";
  });
  await check("algorand-x402-profile-v0.1.settlement-header", checks, () => {
    const headers = new Headers({ "X-PAYMENT-RESPONSE": JSON.stringify({ transactionId: "tx", network: "testnet", asset: "USDC" }) });
    return parseAlgorandX402SettlementHeaders(headers).transactionId === "tx";
  });

  return {
    ok: checks.every((entry) => entry.ok),
    checks
  };
}

async function check(id: string, checks: ConformanceCheck[], fn: () => boolean | Promise<boolean>) {
  try {
    const ok = await fn();
    checks.push({ id, ok, message: ok ? "pass" : "failed expectation" });
  } catch (error) {
    checks.push({ id, ok: false, message: (error as Error).message });
  }
}
