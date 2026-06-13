import {
  canonicalizeJson,
  hashCanonicalJson,
  type AccessEvent,
  type AgentAccessPolicy,
  type ReceiptRecord
} from "@kirkelabs/open-agent-access-core";
import type { MandateDocument } from "@kirkelabs/open-agent-access-mandates";

export interface EvidenceBundle {
  manifestVersion: "0.1";
  createdAt: string;
  policyHash?: string;
  mandateDocumentHash?: string;
  receiptCount: number;
  receiptHashes: string[];
  receiptHead?: string;
  eventCount: number;
  eventHashes: string[];
  eventTrailHash?: string;
  bundleHash: string;
}

export interface ImmutablePutObjectInput {
  key: string;
  body: string;
  contentType: "application/json";
  ifNoneMatch: "*";
  retentionMode?: "governance" | "compliance";
  retainUntil?: string;
  legalHold?: boolean;
  metadata?: Record<string, string>;
}

export interface ImmutablePutObjectResult {
  key: string;
  etag?: string;
  versionId?: string;
}

export interface ImmutableEvidenceStore {
  putObject(input: ImmutablePutObjectInput): Promise<ImmutablePutObjectResult>;
}

export interface EvidenceBundleStorageResult extends ImmutablePutObjectResult {
  bundleHash: string;
  retentionMode?: "governance" | "compliance";
  retainUntil?: string;
  legalHold?: boolean;
}

export function createEvidenceBundle(input: {
  policy?: AgentAccessPolicy;
  mandateDocument?: MandateDocument;
  receipts?: ReceiptRecord[];
  events?: AccessEvent[];
  createdAt?: Date;
}): EvidenceBundle {
  const receipts = input.receipts ?? [];
  const events = input.events ?? receipts.flatMap((receipt) => receipt.events ?? []);
  const receiptHashes = receipts.map((receipt) => receipt.receiptHash ?? hashCanonicalJson(withoutMutableReceiptFields(receipt)));
  const eventHashes = events.map((event) => event.eventHash ?? hashCanonicalJson(withoutEventHash(event)));
  const payload = {
    manifestVersion: "0.1",
    policyHash: input.policy ? hashCanonicalJson(input.policy) : undefined,
    mandateDocumentHash: input.mandateDocument ? hashCanonicalJson(input.mandateDocument) : undefined,
    receiptHashes,
    eventHashes
  };
  return {
    manifestVersion: "0.1",
    createdAt: (input.createdAt ?? new Date()).toISOString(),
    policyHash: payload.policyHash,
    mandateDocumentHash: payload.mandateDocumentHash,
    receiptCount: receipts.length,
    receiptHashes,
    receiptHead: receiptHashes.at(-1),
    eventCount: events.length,
    eventHashes,
    eventTrailHash: eventHashes.length ? hashCanonicalJson(eventHashes) : undefined,
    bundleHash: hashCanonicalJson(payload)
  };
}

export function verifyEvidenceBundle(bundle: EvidenceBundle): { valid: boolean; expectedHash: string; errors: string[] } {
  const expectedHash = hashCanonicalJson({
    manifestVersion: bundle.manifestVersion,
    policyHash: bundle.policyHash,
    mandateDocumentHash: bundle.mandateDocumentHash,
    receiptHashes: bundle.receiptHashes,
    eventHashes: bundle.eventHashes
  });
  const errors: string[] = [];
  if (bundle.manifestVersion !== "0.1") {
    errors.push("unsupported_manifest_version");
  }
  if (bundle.receiptCount !== bundle.receiptHashes.length) {
    errors.push("receipt_count_mismatch");
  }
  if (bundle.eventCount !== bundle.eventHashes.length) {
    errors.push("event_count_mismatch");
  }
  if (bundle.bundleHash !== expectedHash) {
    errors.push("bundle_hash_mismatch");
  }
  if (bundle.receiptHead !== bundle.receiptHashes.at(-1)) {
    errors.push("receipt_head_mismatch");
  }
  return { valid: errors.length === 0, expectedHash, errors };
}

export async function putImmutableEvidenceBundle(
  store: ImmutableEvidenceStore,
  bundle: EvidenceBundle,
  options: {
    prefix?: string;
    retentionMode?: "governance" | "compliance";
    retainUntil?: string;
    legalHold?: boolean;
  } = {}
): Promise<EvidenceBundleStorageResult> {
  const verification = verifyEvidenceBundle(bundle);
  if (!verification.valid) {
    throw new Error(`Invalid evidence bundle: ${verification.errors.join(", ")}`);
  }
  const key = `${options.prefix ?? "oaa-evidence"}/${bundle.bundleHash}.json`;
  const result = await store.putObject({
    key,
    body: `${canonicalizeJson(bundle)}\n`,
    contentType: "application/json",
    ifNoneMatch: "*",
    retentionMode: options.retentionMode,
    retainUntil: options.retainUntil,
    legalHold: options.legalHold,
    metadata: {
      "oaa-bundle-hash": bundle.bundleHash,
      "oaa-manifest-version": bundle.manifestVersion
    }
  });
  return {
    ...result,
    bundleHash: bundle.bundleHash,
    retentionMode: options.retentionMode,
    retainUntil: options.retainUntil,
    legalHold: options.legalHold
  };
}

export function createMemoryImmutableEvidenceStore() {
  const objects = new Map<string, ImmutablePutObjectInput>();
  return {
    objects,
    async putObject(input: ImmutablePutObjectInput): Promise<ImmutablePutObjectResult> {
      if (objects.has(input.key)) {
        throw new Error(`immutable_object_exists:${input.key}`);
      }
      objects.set(input.key, input);
      return {
        key: input.key,
        etag: hashCanonicalJson(input.body),
        versionId: `mem_${objects.size}`
      };
    }
  };
}

function withoutMutableReceiptFields(receipt: ReceiptRecord): ReceiptRecord {
  const clone = { ...receipt };
  delete clone.signature;
  return clone;
}

function withoutEventHash(event: AccessEvent): AccessEvent {
  const clone = { ...event };
  delete clone.eventHash;
  return clone;
}
