import { hashCanonicalJson } from "@kirkelabs/open-agent-access-core";

export interface ReplayStore {
  has(key: string): Promise<boolean> | boolean;
  set(key: string, ttlMs: number): Promise<void> | void;
}

export interface ReplayCheckResult {
  replay: boolean;
  key: string;
}

export interface ResourceBindingInput {
  method: string;
  url: string;
  policyHash: string;
  ruleId?: string;
  traceId?: string;
  idempotencyKey?: string;
}

export function createMemoryReplayStore(options: { maxEntries?: number } = {}): ReplayStore {
  const entries = new Map<string, number>();
  function evict() {
    const now = Date.now();
    for (const [key, expiresAt] of entries) {
      if (expiresAt <= now) entries.delete(key);
    }
    while (entries.size > (options.maxEntries ?? 10_000)) {
      const oldest = entries.keys().next().value as string | undefined;
      if (!oldest) break;
      entries.delete(oldest);
    }
  }
  return {
    has(key: string) {
      evict();
      return entries.has(key);
    },
    set(key: string, ttlMs: number) {
      evict();
      entries.set(key, Date.now() + ttlMs);
    }
  };
}

export function buildResourceBindingHash(input: ResourceBindingInput): string {
  return hashCanonicalJson({
    method: input.method.toUpperCase(),
    url: input.url,
    policyHash: input.policyHash,
    ruleId: input.ruleId,
    traceId: input.traceId,
    idempotencyKey: input.idempotencyKey
  });
}

export function buildReplayKey(input: ResourceBindingInput & { paymentProof?: string; agentId?: string }): string {
  return hashCanonicalJson({
    resource: buildResourceBindingHash(input),
    paymentProof: input.paymentProof,
    agentId: input.agentId
  });
}

export async function checkAndRememberReplay(
  store: ReplayStore,
  key: string,
  ttlMs = 10 * 60_000
): Promise<ReplayCheckResult> {
  if (await store.has(key)) return { replay: true, key };
  await store.set(key, ttlMs);
  return { replay: false, key };
}

export function requireIdempotencyKey(input: {
  method: string;
  decision: string;
  paymentRequired?: boolean;
  idempotencyKey?: string;
}): { ok: boolean; reason?: string } {
  const mutating = ["POST", "PUT", "PATCH", "DELETE"].includes(input.method.toUpperCase());
  if ((mutating || input.paymentRequired || input.decision === "charge") && !input.idempotencyKey) {
    return { ok: false, reason: "idempotency_key_required" };
  }
  return { ok: true };
}
