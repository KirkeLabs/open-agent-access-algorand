import { generateKeyPairSync, sign as nodeSign, verify as nodeVerify } from "node:crypto";
import {
  canonicalizeJson,
  hashCanonicalJson,
  hashPolicy,
  type AgentAccessPolicy
} from "@kirkelabs/open-agent-access-core";

export interface PolicySigningKeyPair {
  publicKeyPem: string;
  privateKeyPem: string;
}

export interface PolicySignature {
  type: "ed25519";
  keyId: string;
  createdAt: string;
  policyHash: string;
  value: string;
}

export interface SignedAgentAccessPolicy extends AgentAccessPolicy {
  policySignature: PolicySignature;
}

export interface TrustedPolicyKey {
  keyId: string;
  publicKeyPem: string;
  notBefore?: string;
  notAfter?: string;
  revoked?: boolean;
}

export interface PolicySignatureVerification {
  ok: boolean;
  reason?: string;
  policyHash: string;
  keyId?: string;
}

export function createPolicySigningKeyPair(): PolicySigningKeyPair {
  const keyPair = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });
  return {
    publicKeyPem: keyPair.publicKey,
    privateKeyPem: keyPair.privateKey
  };
}

export function signAgentAccessPolicy(
  policy: AgentAccessPolicy,
  input: {
    keyId: string;
    privateKeyPem: string;
    createdAt?: Date;
  }
): SignedAgentAccessPolicy {
  const unsigned = withoutPolicySignature(policy);
  const policyHash = hashPolicy(unsigned);
  const createdAt = (input.createdAt ?? new Date()).toISOString();
  const payload = policySignaturePayload(unsigned, input.keyId, createdAt);
  const value = nodeSign(null, Buffer.from(payload), input.privateKeyPem).toString("base64");
  return {
    ...unsigned,
    policySignature: {
      type: "ed25519",
      keyId: input.keyId,
      createdAt,
      policyHash,
      value
    }
  };
}

export function verifySignedAgentAccessPolicy(
  policy: AgentAccessPolicy | SignedAgentAccessPolicy,
  trustedKeys: TrustedPolicyKey[],
  options: { now?: Date } = {}
): PolicySignatureVerification {
  const signature = (policy as SignedAgentAccessPolicy).policySignature;
  const policyHash = hashPolicy(withoutPolicySignature(policy));
  if (!signature) return { ok: false, reason: "policy_signature_missing", policyHash };
  if (signature.type !== "ed25519") return { ok: false, reason: "unsupported_signature_type", policyHash, keyId: signature.keyId };
  if (signature.policyHash !== policyHash) return { ok: false, reason: "policy_hash_mismatch", policyHash, keyId: signature.keyId };
  const key = trustedKeys.find((entry) => entry.keyId === signature.keyId);
  if (!key) return { ok: false, reason: "trusted_key_not_found", policyHash, keyId: signature.keyId };
  if (key.revoked) return { ok: false, reason: "trusted_key_revoked", policyHash, keyId: signature.keyId };
  const now = options.now ?? new Date();
  if (key.notBefore && Date.parse(key.notBefore) > now.getTime()) return { ok: false, reason: "trusted_key_not_yet_valid", policyHash, keyId: signature.keyId };
  if (key.notAfter && Date.parse(key.notAfter) <= now.getTime()) return { ok: false, reason: "trusted_key_expired", policyHash, keyId: signature.keyId };
  const payload = policySignaturePayload(withoutPolicySignature(policy), signature.keyId, signature.createdAt);
  const ok = nodeVerify(null, Buffer.from(payload), key.publicKeyPem, Buffer.from(signature.value, "base64"));
  return { ok, reason: ok ? undefined : "signature_invalid", policyHash, keyId: signature.keyId };
}

export function createPolicyTrustRecord(input: {
  keyId: string;
  publicKeyPem: string;
  controller: string;
  createdAt?: Date;
  notAfter?: string;
}) {
  return {
    trustRecordVersion: "0.1",
    protocol: "open-agent-access",
    kind: "policy-trust-record",
    keyId: input.keyId,
    controller: input.controller,
    publicKeyPem: input.publicKeyPem,
    createdAt: (input.createdAt ?? new Date()).toISOString(),
    notAfter: input.notAfter,
    trustRecordHash: hashCanonicalJson({
      keyId: input.keyId,
      controller: input.controller,
      publicKeyPem: input.publicKeyPem,
      notAfter: input.notAfter
    })
  };
}

function policySignaturePayload(policy: AgentAccessPolicy, keyId: string, createdAt: string): string {
  return canonicalizeJson({
    purpose: "open-agent-access-policy-signature-v0.1",
    keyId,
    createdAt,
    policyHash: hashPolicy(policy)
  });
}

function withoutPolicySignature<T extends AgentAccessPolicy>(policy: T): AgentAccessPolicy {
  const clone = { ...policy } as AgentAccessPolicy & { policySignature?: PolicySignature };
  delete clone.policySignature;
  return clone;
}
