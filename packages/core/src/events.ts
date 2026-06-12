import { createHash, randomUUID } from "node:crypto";
import type { AccessEvent, ReceiptRecord } from "./types.js";
import { hashCanonicalJson } from "./hash.js";

export function createAccessEvent(input: Omit<AccessEvent, "eventVersion" | "eventId" | "timestamp" | "eventHash"> & Partial<AccessEvent>): AccessEvent {
  const event: AccessEvent = {
    ...input,
    eventVersion: "0.1",
    eventId: input.eventId ?? `evt_${randomUUID()}`,
    timestamp: input.timestamp ?? new Date().toISOString()
  };
  event.eventHash = hashCanonicalJson(withoutEventHash(event));
  return event;
}

export function appendAccessEvent(events: AccessEvent[], input: Omit<AccessEvent, "eventVersion" | "eventId" | "timestamp" | "previousEventHash" | "eventHash"> & Partial<AccessEvent>): AccessEvent[] {
  const previousEventHash = events.at(-1)?.eventHash;
  const event = createAccessEvent({ ...input, previousEventHash });
  return [...events, event];
}

export function verifyAccessEventTrail(events: AccessEvent[]) {
  const errors: string[] = [];
  let previousEventHash: string | undefined;
  events.forEach((event, index) => {
    if (event.previousEventHash !== previousEventHash) {
      errors.push(`event ${index + 1}: previousEventHash mismatch`);
    }
    const expected = hashCanonicalJson(withoutEventHash(event));
    if (event.eventHash !== expected) {
      errors.push(`event ${index + 1}: eventHash mismatch`);
    }
    previousEventHash = event.eventHash;
  });
  return { valid: errors.length === 0, count: events.length, errors };
}

export function hashAccessEvents(events: AccessEvent[]): string {
  return createHash("sha256")
    .update(JSON.stringify(events.map((event) => event.eventHash ?? hashCanonicalJson(withoutEventHash(event)))))
    .digest("hex");
}

export function attachEventTrailToReceipt(receipt: ReceiptRecord, events: AccessEvent[]): ReceiptRecord {
  return {
    ...receipt,
    events,
    eventTrailHash: hashAccessEvents(events)
  };
}

function withoutEventHash(event: AccessEvent): AccessEvent {
  const clone = { ...event };
  delete clone.eventHash;
  return clone;
}
