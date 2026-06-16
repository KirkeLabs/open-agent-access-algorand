import {
  hashCanonicalJson,
  sha256Hex,
  type ReceiptRecord
} from "@kirkelabs/open-agent-access-core";

export interface TransparencyLogEntry {
  entryVersion: "0.1";
  index: number;
  kind: "receipt" | "policy" | "bundle" | "custom";
  digest: string;
  timestamp: string;
  metadata?: Record<string, string>;
  leafHash: string;
}

export interface TransparencyLog {
  logVersion: "0.1";
  createdAt: string;
  entries: TransparencyLogEntry[];
  rootHash: string;
  treeSize: number;
}

export interface InclusionProof {
  proofVersion: "0.1";
  index: number;
  treeSize: number;
  leafHash: string;
  rootHash: string;
  auditPath: Array<{ position: "left" | "right"; hash: string }>;
}

export function createTransparencyLog(input: Array<Omit<TransparencyLogEntry, "entryVersion" | "index" | "leafHash">>, createdAt = new Date()): TransparencyLog {
  const entries = input.map((entry, index): TransparencyLogEntry => {
    const leafPayload = {
      kind: entry.kind,
      digest: entry.digest,
      timestamp: entry.timestamp,
      metadata: entry.metadata
    };
    return {
      entryVersion: "0.1",
      index,
      kind: entry.kind,
      digest: entry.digest,
      timestamp: entry.timestamp,
      metadata: entry.metadata,
      leafHash: leafHash(leafPayload)
    };
  });
  return {
    logVersion: "0.1",
    createdAt: createdAt.toISOString(),
    entries,
    rootHash: merkleRoot(entries.map((entry) => entry.leafHash)),
    treeSize: entries.length
  };
}

export function receiptToTransparencyEntry(receipt: ReceiptRecord): Omit<TransparencyLogEntry, "entryVersion" | "index" | "leafHash"> {
  return {
    kind: "receipt",
    digest: receipt.receiptHash ?? hashCanonicalJson(receipt),
    timestamp: receipt.timestamp,
    metadata: {
      receiptId: receipt.receiptId,
      traceId: receipt.traceId,
      decision: receipt.policy?.decision ?? "",
      ruleId: receipt.policy?.ruleId ?? ""
    }
  };
}

export function createInclusionProof(log: TransparencyLog, index: number): InclusionProof {
  const leaf = log.entries[index];
  if (!leaf) throw new Error(`No transparency entry at index ${index}`);
  const auditPath: InclusionProof["auditPath"] = [];
  let level = log.entries.map((entry) => entry.leafHash);
  let cursor = index;
  while (level.length > 1) {
    const sibling = cursor % 2 === 0 ? cursor + 1 : cursor - 1;
    const siblingHash = level[sibling] ?? level[cursor];
    if (!siblingHash) throw new Error(`Missing transparency hash at level index ${cursor}`);
    auditPath.push({
      position: cursor % 2 === 0 ? "right" : "left",
      hash: siblingHash
    });
    cursor = Math.floor(cursor / 2);
    level = nextMerkleLevel(level);
  }
  return {
    proofVersion: "0.1",
    index,
    treeSize: log.treeSize,
    leafHash: leaf.leafHash,
    rootHash: log.rootHash,
    auditPath
  };
}

export function verifyInclusionProof(proof: InclusionProof): boolean {
  let hash = proof.leafHash;
  for (const sibling of proof.auditPath) {
    hash = sibling.position === "left" ? nodeHash(sibling.hash, hash) : nodeHash(hash, sibling.hash);
  }
  return hash === proof.rootHash;
}

export function merkleRoot(hashes: string[]): string {
  if (!hashes.length) return sha256Hex("oaa-empty-transparency-log-v0.1");
  let level = [...hashes];
  while (level.length > 1) level = nextMerkleLevel(level);
  return level[0] as string;
}

function nextMerkleLevel(level: string[]): string[] {
  const next: string[] = [];
  for (let index = 0; index < level.length; index += 2) {
    const left = level[index] as string;
    const right = level[index + 1] ?? left;
    next.push(nodeHash(left, right));
  }
  return next;
}

function leafHash(value: unknown): string {
  return sha256Hex(`leaf:${hashCanonicalJson(value)}`);
}

function nodeHash(left: string, right: string): string {
  return sha256Hex(`node:${left}:${right}`);
}
