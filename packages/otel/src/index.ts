import {
  hashCanonicalJson,
  type AccessEvent,
  type DecisionResult,
  type ReceiptRecord
} from "@kirkelabs/open-agent-access-core";

export type OTelAttributeValue = string | number | boolean | string[];

export interface OTelSpanLike {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: "oaa.agent_access" | "oaa.policy_decision" | "oaa.payment" | "oaa.tool_call";
  kind: "client" | "server" | "internal";
  startTimeUnixNano: string;
  endTimeUnixNano?: string;
  attributes: Record<string, OTelAttributeValue>;
  status?: {
    code: "OK" | "ERROR" | "UNSET";
    message?: string;
  };
}

export interface OTelLogRecordLike {
  traceId: string;
  observedTimeUnixNano: string;
  severityText: "INFO" | "WARN" | "ERROR";
  body: string;
  attributes: Record<string, OTelAttributeValue>;
}

export const OAA_OTEL_ATTRIBUTES = {
  receiptId: "oaa.receipt.id",
  receiptHash: "oaa.receipt.hash",
  role: "oaa.role",
  method: "oaa.method",
  url: "oaa.url",
  origin: "oaa.origin",
  agentId: "oaa.agent.id",
  purpose: "oaa.declared.purpose",
  use: "oaa.declared.use",
  decision: "oaa.policy.decision",
  ruleId: "oaa.policy.rule_id",
  policyHash: "oaa.policy.hash",
  paymentRequired: "oaa.payment.required",
  paymentSettlement: "oaa.payment.settlement",
  paymentNetwork: "oaa.payment.network",
  transactionId: "oaa.payment.transaction_id",
  eventType: "oaa.event.type",
  eventTrailHash: "oaa.event_trail.hash"
} as const;

export function receiptToOtelSpan(receipt: ReceiptRecord, options: {
  redactUrl?: boolean;
  parentSpanId?: string;
} = {}): OTelSpanLike {
  const timestamp = unixNano(receipt.timestamp);
  return {
    traceId: normalizeTraceId(receipt.traceId),
    spanId: hashCanonicalJson({ receiptId: receipt.receiptId }).slice(0, 16),
    parentSpanId: options.parentSpanId,
    name: receipt.payment?.required ? "oaa.payment" : "oaa.agent_access",
    kind: receipt.role === "agent" ? "client" : "server",
    startTimeUnixNano: timestamp,
    attributes: compactAttributes({
      [OAA_OTEL_ATTRIBUTES.receiptId]: receipt.receiptId,
      [OAA_OTEL_ATTRIBUTES.receiptHash]: receipt.receiptHash,
      [OAA_OTEL_ATTRIBUTES.role]: receipt.role,
      [OAA_OTEL_ATTRIBUTES.method]: receipt.method,
      [OAA_OTEL_ATTRIBUTES.url]: options.redactUrl ? redactUrl(receipt.url) : receipt.url,
      [OAA_OTEL_ATTRIBUTES.origin]: receipt.origin,
      [OAA_OTEL_ATTRIBUTES.agentId]: receipt.agent?.id,
      [OAA_OTEL_ATTRIBUTES.purpose]: receipt.declared?.purpose,
      [OAA_OTEL_ATTRIBUTES.use]: receipt.declared?.use,
      [OAA_OTEL_ATTRIBUTES.decision]: receipt.policy?.decision,
      [OAA_OTEL_ATTRIBUTES.ruleId]: receipt.policy?.ruleId,
      [OAA_OTEL_ATTRIBUTES.policyHash]: receipt.policy?.policyHash,
      [OAA_OTEL_ATTRIBUTES.paymentRequired]: receipt.payment?.required ?? false,
      [OAA_OTEL_ATTRIBUTES.paymentSettlement]: receipt.payment?.settlement,
      [OAA_OTEL_ATTRIBUTES.paymentNetwork]: receipt.payment?.network,
      [OAA_OTEL_ATTRIBUTES.transactionId]: receipt.payment?.transactionId,
      [OAA_OTEL_ATTRIBUTES.eventTrailHash]: receipt.eventTrailHash
    }),
    status: {
      code: receipt.policy?.decision === "deny" || receipt.policy?.decision === "human_only" ? "ERROR" : "OK",
      message: receipt.policy?.decision
    }
  };
}

export function accessEventToOtelLog(event: AccessEvent): OTelLogRecordLike {
  return {
    traceId: normalizeTraceId(event.traceId),
    observedTimeUnixNano: unixNano(event.timestamp),
    severityText: event.type === "denied" || event.type === "rolled_back" ? "ERROR" : event.type === "human_escalated" ? "WARN" : "INFO",
    body: `oaa.${event.type}`,
    attributes: compactAttributes({
      [OAA_OTEL_ATTRIBUTES.eventType]: event.type,
      [OAA_OTEL_ATTRIBUTES.method]: event.subject?.method,
      [OAA_OTEL_ATTRIBUTES.url]: event.subject?.url,
      [OAA_OTEL_ATTRIBUTES.decision]: event.policy?.decision,
      [OAA_OTEL_ATTRIBUTES.ruleId]: event.policy?.ruleId,
      [OAA_OTEL_ATTRIBUTES.policyHash]: event.policy?.policyHash,
      "oaa.actor.role": event.actor?.role,
      "oaa.actor.id": event.actor?.id,
      "oaa.event.hash": event.eventHash
    })
  };
}

export function decisionToOtelSpan(input: {
  traceId: string;
  decision: DecisionResult;
  method: string;
  url: string;
  policyHash?: string;
  timestamp?: string;
}): OTelSpanLike {
  return {
    traceId: normalizeTraceId(input.traceId),
    spanId: hashCanonicalJson({ traceId: input.traceId, decision: input.decision.reason }).slice(0, 16),
    name: "oaa.policy_decision",
    kind: "internal",
    startTimeUnixNano: unixNano(input.timestamp ?? new Date().toISOString()),
    attributes: compactAttributes({
      [OAA_OTEL_ATTRIBUTES.method]: input.method,
      [OAA_OTEL_ATTRIBUTES.url]: input.url,
      [OAA_OTEL_ATTRIBUTES.decision]: input.decision.decision,
      [OAA_OTEL_ATTRIBUTES.ruleId]: input.decision.rule?.id,
      [OAA_OTEL_ATTRIBUTES.policyHash]: input.policyHash,
      "oaa.decision.reason": input.decision.reason
    }),
    status: {
      code: input.decision.decision === "deny" || input.decision.decision === "human_only" ? "ERROR" : "OK",
      message: input.decision.reason
    }
  };
}

function compactAttributes(input: Record<string, OTelAttributeValue | undefined>): Record<string, OTelAttributeValue> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Record<string, OTelAttributeValue>;
}

function unixNano(timestamp: string): string {
  return String(BigInt(Date.parse(timestamp)) * 1_000_000n);
}

function normalizeTraceId(traceId: string): string {
  return hashCanonicalJson({ traceId }).slice(0, 32);
}

function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "[redacted-url]";
  }
}
