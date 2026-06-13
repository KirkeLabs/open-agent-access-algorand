import { generateKeyPairSync, sign as nodeSign, verify as nodeVerify } from "node:crypto";
import { canonicalizeJson, hashCanonicalJson } from "@kirkelabs/open-agent-access-core";

export interface AgentIdentityKeyPair {
  publicKeyPem: string;
  privateKeyPem: string;
}

export interface TrustedAgentKey {
  keyId: string;
  publicKeyPem: string;
  agentId?: string;
  expiresAt?: string;
}

export interface AgentSignatureContext {
  method: string;
  url: string;
}

export interface SignAgentAccessHeadersOptions extends AgentSignatureContext {
  privateKeyPem: string;
  keyId: string;
  createdAt?: Date;
}

export interface VerifyAgentAccessHeadersOptions extends AgentSignatureContext {
  trustedKeys: TrustedAgentKey[];
  now?: Date;
  maxSkewMs?: number;
}

export interface AgentSignatureVerification {
  ok: boolean;
  reason: "verified" | "missing_signature" | "unknown_key" | "key_expired" | "agent_mismatch" | "timestamp_skew" | "invalid_signature";
  keyId?: string;
  agentId?: string;
  signatureInputHash?: string;
}

const SIGNED_HEADERS = [
  "AA-Agent-ID",
  "AA-Agent-Name",
  "AA-Agent-Operator",
  "AA-Agent-Principal",
  "AA-Purpose",
  "AA-Use",
  "AA-Budget",
  "AA-Trace-ID",
  "AA-Protocol-Version"
];

export function createAgentIdentityKeyPair(): AgentIdentityKeyPair {
  const keyPair = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });
  return {
    publicKeyPem: keyPair.publicKey,
    privateKeyPem: keyPair.privateKey
  };
}

export function buildAgentSignatureInput(headers: Headers, context: AgentSignatureContext) {
  const signedHeaders: Record<string, string> = {};
  for (const name of SIGNED_HEADERS) {
    const value = headers.get(name);
    if (value !== null) {
      signedHeaders[name.toLowerCase()] = value;
    }
  }
  return {
    protocol: "open-agent-access",
    version: "0.1",
    method: context.method.toUpperCase(),
    url: context.url,
    headers: signedHeaders
  };
}

export function signAgentAccessHeaders(headers: Headers, options: SignAgentAccessHeadersOptions): Headers {
  const createdAt = options.createdAt ?? new Date();
  headers.set("AA-Agent-Key-ID", options.keyId);
  headers.set("AA-Agent-Signature-Created", createdAt.toISOString());
  const payload = buildAgentSignatureInput(headers, options);
  const signature = nodeSign(null, Buffer.from(canonicalizeJson(payload)), options.privateKeyPem).toString("base64");
  headers.set("AA-Agent-Signature", signature);
  headers.set("AA-Agent-Signature-Input-Hash", hashCanonicalJson(payload));
  return headers;
}

export function verifyAgentAccessHeaders(headers: Headers, options: VerifyAgentAccessHeadersOptions): AgentSignatureVerification {
  const signature = headers.get("AA-Agent-Signature");
  const keyId = headers.get("AA-Agent-Key-ID") ?? undefined;
  const created = headers.get("AA-Agent-Signature-Created");
  if (!signature || !keyId || !created) {
    return { ok: false, reason: "missing_signature", keyId };
  }

  const trusted = options.trustedKeys.find((key) => key.keyId === keyId);
  if (!trusted) {
    return { ok: false, reason: "unknown_key", keyId };
  }
  const now = options.now ?? new Date();
  if (trusted.expiresAt && Date.parse(trusted.expiresAt) <= now.getTime()) {
    return { ok: false, reason: "key_expired", keyId };
  }
  const agentId = headers.get("AA-Agent-ID") ?? undefined;
  if (trusted.agentId && trusted.agentId !== agentId) {
    return { ok: false, reason: "agent_mismatch", keyId, agentId };
  }
  const createdAt = Date.parse(created);
  const maxSkewMs = options.maxSkewMs ?? 5 * 60_000;
  if (!Number.isFinite(createdAt) || Math.abs(now.getTime() - createdAt) > maxSkewMs) {
    return { ok: false, reason: "timestamp_skew", keyId, agentId };
  }

  const payload = buildAgentSignatureInput(headers, options);
  const ok = nodeVerify(null, Buffer.from(canonicalizeJson(payload)), trusted.publicKeyPem, Buffer.from(signature, "base64"));
  return {
    ok,
    reason: ok ? "verified" : "invalid_signature",
    keyId,
    agentId,
    signatureInputHash: hashCanonicalJson(payload)
  };
}

export function parseTrustedAgentKeys(input: unknown): TrustedAgentKey[] {
  if (!Array.isArray(input)) {
    throw new Error("trusted agent keys must be an array");
  }
  return input.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`trusted agent key ${index} must be an object`);
    }
    const record = entry as Record<string, unknown>;
    if (typeof record.keyId !== "string" || typeof record.publicKeyPem !== "string") {
      throw new Error(`trusted agent key ${index} requires keyId and publicKeyPem`);
    }
    return {
      keyId: record.keyId,
      publicKeyPem: record.publicKeyPem,
      agentId: typeof record.agentId === "string" ? record.agentId : undefined,
      expiresAt: typeof record.expiresAt === "string" ? record.expiresAt : undefined
    };
  });
}
