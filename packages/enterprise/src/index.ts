import {
  hashCanonicalJson,
  type AccessEvent,
  type AgentAccessDecision,
  type AgentAccessPolicy,
  type AgentAccessRule,
  type Budget,
  type ReceiptRecord
} from "@kirkelabs/open-agent-access-core";
import type { MandateDocument } from "@kirkelabs/open-agent-access-mandates";

export type EnterpriseRiskLevel = "low" | "medium" | "high" | "critical";
export type ControlSeverity = "info" | "warning" | "error";

export interface EnterpriseControlFinding {
  id: string;
  severity: ControlSeverity;
  title: string;
  detail: string;
  path?: string;
  recommendation: string;
}

export interface EnterpriseControlReport {
  reportVersion: "0.1";
  generatedAt: string;
  ok: boolean;
  score: number;
  policyHash: string;
  mandateDocumentHash?: string;
  receiptCount?: number;
  findings: EnterpriseControlFinding[];
  summary: {
    errors: number;
    warnings: number;
    infos: number;
  };
}

export interface EnterpriseRiskInput {
  decision: AgentAccessDecision;
  method?: string;
  url?: string;
  purpose?: string;
  use?: string;
  budget?: Budget;
  rule?: AgentAccessRule;
  mandateDecision?: string;
  paymentRequired?: boolean;
  dataSensitivity?: "public" | "internal" | "confidential" | "restricted";
}

export interface EnterpriseRiskAssessment {
  riskVersion: "0.1";
  level: EnterpriseRiskLevel;
  score: number;
  reasons: string[];
  recommendedControls: string[];
}

export interface EnterpriseAuditExportOptions {
  redact?: boolean;
  redactionMode?: "pii-safe" | "strict";
}

export interface OpenTelemetryAccessSpan {
  traceId: string;
  spanId: string;
  name: "oaa.agent_access";
  kind: "client" | "server" | "internal";
  startTimeUnixNano: string;
  attributes: Record<string, string | number | boolean>;
}

export interface EvidenceBundleDigest {
  digestVersion: "0.1";
  generatedAt: string;
  policyHash?: string;
  mandateDocumentHash?: string;
  receiptCount: number;
  receiptHead?: string;
  eventCount: number;
  eventTrailHash?: string;
  bundleHash: string;
}

export function createEnterpriseControlReport(input: {
  policy: AgentAccessPolicy;
  mandateDocument?: MandateDocument;
  receipts?: ReceiptRecord[];
  now?: Date;
}): EnterpriseControlReport {
  const findings: EnterpriseControlFinding[] = [];
  const now = input.now ?? new Date();
  const policyHash = hashCanonicalJson(input.policy);

  checkPolicyDefaults(input.policy, findings);
  checkPolicyOperationalControls(input.policy, findings, now);
  checkRules(input.policy.rules, findings);
  if (input.mandateDocument) {
    checkMandates(input.mandateDocument, findings, now);
  } else {
    findings.push(finding("OAA-ENT-020", "warning", "Mandate document not supplied", "Enterprise deployments should bind agent actions to delegated authority.", "mandates", "Publish and validate /.well-known/agent-mandates.json."));
  }
  if (input.receipts) {
    checkReceipts(input.receipts, findings);
  }

  const errors = findings.filter((entry) => entry.severity === "error").length;
  const warnings = findings.filter((entry) => entry.severity === "warning").length;
  const infos = findings.filter((entry) => entry.severity === "info").length;
  const score = Math.max(0, 100 - errors * 20 - warnings * 7);

  return {
    reportVersion: "0.1",
    generatedAt: now.toISOString(),
    ok: errors === 0,
    score,
    policyHash,
    mandateDocumentHash: input.mandateDocument ? hashCanonicalJson(input.mandateDocument) : undefined,
    receiptCount: input.receipts?.length,
    findings,
    summary: { errors, warnings, infos }
  };
}

export function assessEnterpriseAccessRisk(input: EnterpriseRiskInput): EnterpriseRiskAssessment {
  let score = 10;
  const reasons: string[] = [];
  const recommendedControls = new Set<string>();

  if (["deny", "human_only", "review"].includes(input.decision)) {
    score += 10;
    reasons.push(`decision:${input.decision}`);
  }
  if (input.decision === "charge" || input.paymentRequired) {
    score += 20;
    reasons.push("payment_required");
    recommendedControls.add("budget_ceiling");
    recommendedControls.add("settlement_receipt");
  }
  if (["POST", "PUT", "PATCH", "DELETE"].includes((input.method ?? "GET").toUpperCase())) {
    score += 20;
    reasons.push("mutating_method");
    recommendedControls.add("idempotency_key");
    recommendedControls.add("human_approval_for_high_consequence_mutation");
  }
  if (input.use === "ai-train") {
    score += 30;
    reasons.push("training_use");
    recommendedControls.add("explicit_training_permission");
  }
  if (input.mandateDecision && input.mandateDecision !== "allow") {
    score += 25;
    reasons.push(`mandate:${input.mandateDecision}`);
    recommendedControls.add("human_escalation");
  }
  if (input.dataSensitivity === "confidential") {
    score += 25;
    reasons.push("confidential_data");
    recommendedControls.add("pii_safe_audit_export");
  }
  if (input.dataSensitivity === "restricted") {
    score += 40;
    reasons.push("restricted_data");
    recommendedControls.add("fail_closed_policy");
    recommendedControls.add("approval_threshold");
  }
  if (input.budget && Number(input.budget.amount) > 1) {
    score += 15;
    reasons.push("large_budget");
    recommendedControls.add("spend_approval");
  }

  return {
    riskVersion: "0.1",
    level: riskLevel(score),
    score: Math.min(score, 100),
    reasons,
    recommendedControls: [...recommendedControls].sort()
  };
}

export function redactEnterpriseAuditRecord<T>(record: T, options: EnterpriseAuditExportOptions = {}): T {
  if (!options.redact) {
    return record;
  }
  return redactValue(record, options.redactionMode ?? "pii-safe") as T;
}

export function receiptToOpenTelemetrySpan(receipt: ReceiptRecord, options: EnterpriseAuditExportOptions = {}): OpenTelemetryAccessSpan {
  const safeReceipt = redactEnterpriseAuditRecord(receipt, options);
  const timestamp = Date.parse(receipt.timestamp || new Date().toISOString());
  return {
    traceId: normalizeTraceId(receipt.traceId),
    spanId: hashCanonicalJson({ receiptId: receipt.receiptId }).slice(0, 16),
    name: "oaa.agent_access",
    kind: receipt.role === "agent" ? "client" : "server",
    startTimeUnixNano: String(BigInt(timestamp) * 1_000_000n),
    attributes: {
      "oaa.receipt_id": receipt.receiptId,
      "oaa.role": receipt.role,
      "oaa.method": receipt.method,
      "oaa.url": String((safeReceipt as ReceiptRecord).url),
      "oaa.origin": receipt.origin,
      "oaa.policy.rule_id": receipt.policy?.ruleId ?? "",
      "oaa.policy.decision": receipt.policy?.decision ?? "",
      "oaa.payment.required": receipt.payment?.required ?? false,
      "oaa.payment.settlement": receipt.payment?.settlement ?? "",
      "oaa.receipt_hash": receipt.receiptHash ?? "",
      "oaa.event_trail_hash": receipt.eventTrailHash ?? ""
    }
  };
}

export function receiptToCefEvent(receipt: ReceiptRecord, options: EnterpriseAuditExportOptions = {}): string {
  const safeReceipt = redactEnterpriseAuditRecord(receipt, options);
  const severity = receipt.policy?.decision === "deny" || receipt.policy?.decision === "human_only" ? 7 : receipt.payment?.required ? 5 : 3;
  const extension = [
    ["rt", receipt.timestamp],
    ["src", receipt.origin],
    ["requestMethod", receipt.method],
    ["request", (safeReceipt as ReceiptRecord).url],
    ["cs1Label", "traceId"],
    ["cs1", receipt.traceId],
    ["cs2Label", "decision"],
    ["cs2", receipt.policy?.decision ?? "unknown"],
    ["cs3Label", "receiptHash"],
    ["cs3", receipt.receiptHash ?? ""]
  ].map(([key, value]) => `${key}=${escapeCef(String(value))}`).join(" ");
  return `CEF:0|Open Agent Access|OAA|0.1|agent_access|Agent Access Receipt|${severity}|${extension}`;
}

export function createEvidenceBundleDigest(input: {
  policy?: AgentAccessPolicy;
  mandateDocument?: MandateDocument;
  receipts?: ReceiptRecord[];
  events?: AccessEvent[];
  generatedAt?: Date;
}): EvidenceBundleDigest {
  const receipts = input.receipts ?? [];
  const events = input.events ?? receipts.flatMap((receipt) => receipt.events ?? []);
  const payload = {
    policyHash: input.policy ? hashCanonicalJson(input.policy) : undefined,
    mandateDocumentHash: input.mandateDocument ? hashCanonicalJson(input.mandateDocument) : undefined,
    receiptHashes: receipts.map((receipt) => receipt.receiptHash),
    eventHashes: events.map((event) => event.eventHash)
  };
  return {
    digestVersion: "0.1",
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    policyHash: payload.policyHash,
    mandateDocumentHash: payload.mandateDocumentHash,
    receiptCount: receipts.length,
    receiptHead: receipts.at(-1)?.receiptHash,
    eventCount: events.length,
    eventTrailHash: events.length ? hashCanonicalJson(events.map((event) => event.eventHash)) : undefined,
    bundleHash: hashCanonicalJson(payload)
  };
}

function checkPolicyDefaults(policy: AgentAccessPolicy, findings: EnterpriseControlFinding[]) {
  if (policy.defaults?.decision === "allow") {
    findings.push(finding("OAA-ENT-001", "error", "Default decision allows access", "Enterprise policies should fail closed by default.", "defaults.decision", "Use review or deny as the default decision."));
  }
  if (!policy.defaults?.requireAgentIdentity) {
    findings.push(finding("OAA-ENT-002", "error", "Agent identity is not required", "Enterprise access needs declared agent identity.", "defaults.requireAgentIdentity", "Set requireAgentIdentity to true."));
  }
  if (!policy.defaults?.requirePurpose) {
    findings.push(finding("OAA-ENT-003", "error", "Purpose is not required", "Enterprise access needs a declared purpose.", "defaults.requirePurpose", "Set requirePurpose to true."));
  }
  if (!policy.defaults?.requireReceipt) {
    findings.push(finding("OAA-ENT-004", "warning", "Receipts are not required by default", "Auditability is weaker without default receipt requirements.", "defaults.requireReceipt", "Set requireReceipt to true."));
  }
  if (!policy.defaults?.respectRobotsTxt) {
    findings.push(finding("OAA-ENT-005", "warning", "robots.txt respect is not declared", "Enterprise deployments should preserve existing crawl posture.", "defaults.respectRobotsTxt", "Set respectRobotsTxt to true."));
  }
}

function checkPolicyOperationalControls(policy: AgentAccessPolicy, findings: EnterpriseControlFinding[], now: Date) {
  if (!policy.site.securityContact) {
    findings.push(finding("OAA-ENT-010", "warning", "Security contact missing", "Incident response needs a security contact.", "site.securityContact", "Add a securityContact mailto or URL."));
  }
  if (!policy.reviewUrl) {
    findings.push(finding("OAA-ENT-011", "warning", "Review URL missing", "Review and escalation paths should be machine readable.", "reviewUrl", "Add reviewUrl for disputed or high-consequence access."));
  }
  if (!policy.expiresAt) {
    findings.push(finding("OAA-ENT-012", "warning", "Policy expiry missing", "Policies should be reviewed and reissued periodically.", "expiresAt", "Add expiresAt and rotate policy versions."));
  } else if (Date.parse(policy.expiresAt) <= now.getTime()) {
    findings.push(finding("OAA-ENT-013", "error", "Policy is expired", "Expired policy should not be used for enterprise decisions.", "expiresAt", "Publish a current policy."));
  }
  findings.push(finding("OAA-ENT-014", "info", "Verify agent identities in production middleware", "Declared agent headers should be backed by signed identity in enterprise deployments.", "middleware.agentIdentity", "Enable agentIdentity.required with trusted public keys or a federated verifier."));
}

function checkRules(rules: AgentAccessRule[], findings: EnterpriseControlFinding[]) {
  rules.forEach((rule, index) => {
    const path = `rules[${index}]`;
    if ((rule.decision === "allow" || rule.decision === "charge") && !rule.rateLimit) {
      findings.push(finding("OAA-ENT-030", "warning", `Rule ${rule.id} has no rate limit`, "Enterprise allow/charge rules should have explicit rate limits.", `${path}.rateLimit`, "Add requests/window/burst limits."));
    }
    if ((rule.decision === "allow" || rule.decision === "charge") && !rule.loadPolicy?.emergencyStop) {
      findings.push(finding("OAA-ENT-031", "warning", `Rule ${rule.id} has no emergency stop`, "Resource owners need a machine-readable stop path.", `${path}.loadPolicy.emergencyStop`, "Add loadPolicy.emergencyStop."));
    }
    if (rule.decision === "charge") {
      if (!rule.price) {
        findings.push(finding("OAA-ENT-032", "error", `Charged rule ${rule.id} has no price`, "Paid access needs explicit price terms.", `${path}.price`, "Add amount, currency, and unit."));
      }
      if (!rule.payment) {
        findings.push(finding("OAA-ENT-033", "error", `Charged rule ${rule.id} has no payment config`, "Paid access needs settlement metadata.", `${path}.payment`, "Add x402 Algorand payment requirements."));
      }
      if (!rule.receipt?.required) {
        findings.push(finding("OAA-ENT-034", "error", `Charged rule ${rule.id} does not require receipts`, "Paid access must produce bilateral evidence.", `${path}.receipt.required`, "Set receipt.required to true."));
      }
    }
    if (!rule.deniedUses?.includes("ai-train") && rule.training !== false) {
      findings.push(finding("OAA-ENT-035", "info", `Rule ${rule.id} does not explicitly deny training`, "Training posture should be explicit.", `${path}.deniedUses`, "Add ai-train to deniedUses or set training explicitly."));
    }
  });
}

function checkMandates(document: MandateDocument, findings: EnterpriseControlFinding[], now: Date) {
  if (document.mandates.length === 0) {
    findings.push(finding("OAA-ENT-021", "error", "Mandate document has no mandates", "Enterprise agents need delegated authority records.", "mandates", "Add at least one scoped mandate."));
  }
  document.mandates.forEach((mandate, index) => {
    const path = `mandates[${index}]`;
    const expiresAt = Date.parse(mandate.expiresAt);
    if (expiresAt <= now.getTime()) {
      findings.push(finding("OAA-ENT-022", "error", `Mandate ${mandate.id} is expired`, "Expired mandates must not authorize agent actions.", `${path}.expiresAt`, "Issue a fresh mandate."));
    }
    if (!mandate.revocation?.url && !mandate.revocation?.contact) {
      findings.push(finding("OAA-ENT-023", "warning", `Mandate ${mandate.id} has no revocation path`, "Delegated authority needs a shutdown path.", `${path}.revocation`, "Add revocation.url or revocation.contact."));
    }
    if (!mandate.evidence?.receiptRequired) {
      findings.push(finding("OAA-ENT-024", "warning", `Mandate ${mandate.id} does not require receipts`, "Mandated actions should leave evidence.", `${path}.evidence.receiptRequired`, "Set evidence.receiptRequired to true."));
    }
    if (!mandate.evidence?.policyHashRequired) {
      findings.push(finding("OAA-ENT-025", "warning", `Mandate ${mandate.id} does not require policy hashes`, "Receipts should bind actions to the policy in force.", `${path}.evidence.policyHashRequired`, "Set evidence.policyHashRequired to true."));
    }
  });
}

function checkReceipts(receipts: ReceiptRecord[], findings: EnterpriseControlFinding[]) {
  receipts.forEach((receipt, index) => {
    if (!receipt.policy?.policyHash) {
      findings.push(finding("OAA-ENT-040", "warning", `Receipt ${receipt.receiptId} has no policy hash`, "Audit evidence should bind to policy state.", `receipts[${index}].policy.policyHash`, "Write policyHash into receipts."));
    }
    if (receipt.payment?.required && !receipt.payment.settlementSuccess) {
      findings.push(finding("OAA-ENT-041", "warning", `Receipt ${receipt.receiptId} payment not settled`, "Paid access should record settlement outcome.", `receipts[${index}].payment.settlementSuccess`, "Record settlementSuccess and transaction metadata."));
    }
  });
}

function finding(id: string, severity: ControlSeverity, title: string, detail: string, path: string, recommendation: string): EnterpriseControlFinding {
  return { id, severity, title, detail, path, recommendation };
}

function riskLevel(score: number): EnterpriseRiskLevel {
  if (score >= 80) return "critical";
  if (score >= 55) return "high";
  if (score >= 30) return "medium";
  return "low";
}

function redactValue(value: unknown, mode: "pii-safe" | "strict"): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry, mode));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    const lower = key.toLowerCase();
    if (["principal", "contact", "securitycontact", "payer"].includes(lower) || (mode === "strict" && ["payto", "url"].includes(lower))) {
      output[key] = `[redacted:${hashCanonicalJson(nested).slice(0, 12)}]`;
    } else {
      output[key] = redactValue(nested, mode);
    }
  }
  return output;
}

function normalizeTraceId(traceId: string): string {
  const hex = traceId.replace(/[^a-fA-F0-9]/g, "");
  if (hex.length >= 32) return hex.slice(0, 32).toLowerCase();
  return hashCanonicalJson({ traceId }).slice(0, 32);
}

function escapeCef(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/=/g, "\\=").replace(/\n/g, "\\n").replace(/\r/g, "\\r");
}
