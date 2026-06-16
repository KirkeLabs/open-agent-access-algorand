import {
  hashCanonicalJson,
  type AgentAccessPolicy,
  type ReceiptRecord
} from "@kirkelabs/open-agent-access-core";
import type { TransparencyLog } from "@kirkelabs/open-agent-access-transparency";

export type AlgorandAnchorKind = "policy" | "receipt" | "transparency-root" | "evidence-bundle" | "custom";

export interface AlgorandAnchorPayload {
  anchorVersion: "0.1";
  protocol: "open-agent-access";
  kind: AlgorandAnchorKind;
  network: "testnet" | "mainnet" | "localnet" | string;
  digest: string;
  createdAt: string;
  metadata?: Record<string, string>;
}

export interface AlgorandAnchorRecord {
  recordVersion: "0.1";
  payload: AlgorandAnchorPayload;
  payloadHash: string;
  transactionId?: string;
  confirmedRound?: number;
  notePrefix: "oaa-anchor-v0.1";
}

export function createAlgorandAnchorPayload(input: Omit<AlgorandAnchorPayload, "anchorVersion" | "protocol" | "createdAt"> & { createdAt?: Date }): AlgorandAnchorPayload {
  return {
    anchorVersion: "0.1",
    protocol: "open-agent-access",
    kind: input.kind,
    network: input.network,
    digest: input.digest,
    metadata: input.metadata,
    createdAt: (input.createdAt ?? new Date()).toISOString()
  };
}

export function createPolicyAnchorPayload(policy: AgentAccessPolicy, network: string, metadata?: Record<string, string>): AlgorandAnchorPayload {
  return createAlgorandAnchorPayload({ kind: "policy", network, digest: hashCanonicalJson(policy), metadata });
}

export function createReceiptAnchorPayload(receipt: ReceiptRecord, network: string, metadata?: Record<string, string>): AlgorandAnchorPayload {
  return createAlgorandAnchorPayload({ kind: "receipt", network, digest: receipt.receiptHash ?? hashCanonicalJson(receipt), metadata });
}

export function createTransparencyRootAnchorPayload(log: TransparencyLog, network: string, metadata?: Record<string, string>): AlgorandAnchorPayload {
  return createAlgorandAnchorPayload({ kind: "transparency-root", network, digest: log.rootHash, metadata: { treeSize: String(log.treeSize), ...metadata } });
}

export function createAlgorandAnchorRecord(payload: AlgorandAnchorPayload, settlement?: { transactionId?: string; confirmedRound?: number }): AlgorandAnchorRecord {
  return {
    recordVersion: "0.1",
    payload,
    payloadHash: hashCanonicalJson(payload),
    transactionId: settlement?.transactionId,
    confirmedRound: settlement?.confirmedRound,
    notePrefix: "oaa-anchor-v0.1"
  };
}

export function buildAlgorandAnchorNote(payload: AlgorandAnchorPayload): string {
  return `oaa-anchor-v0.1:${hashCanonicalJson(payload)}:${payload.kind}:${payload.digest}`;
}

export function verifyAlgorandAnchorRecord(record: AlgorandAnchorRecord, expected?: { digest?: string; network?: string; kind?: AlgorandAnchorKind }): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (record.recordVersion !== "0.1") errors.push("unsupported_record_version");
  if (record.notePrefix !== "oaa-anchor-v0.1") errors.push("unsupported_note_prefix");
  if (record.payloadHash !== hashCanonicalJson(record.payload)) errors.push("payload_hash_mismatch");
  if (record.payload.protocol !== "open-agent-access") errors.push("protocol_mismatch");
  if (expected?.digest && record.payload.digest !== expected.digest) errors.push("digest_mismatch");
  if (expected?.network && record.payload.network !== expected.network) errors.push("network_mismatch");
  if (expected?.kind && record.payload.kind !== expected.kind) errors.push("kind_mismatch");
  return { valid: errors.length === 0, errors };
}
