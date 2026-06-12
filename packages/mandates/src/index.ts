import { z } from "zod";
import { hashCanonicalJson, pathMatches, type AgentIdentity, type Budget } from "@open-agent-access/core";

export type MandateDecision = "allow" | "deny" | "needs_approval" | "expired";

export interface MandateDelegator {
  id: string;
  name?: string;
  contact?: string;
}

export interface MandateSubject {
  agentId: string;
  principal?: string;
  operator?: string;
}

export interface MandateScope {
  purposes: string[];
  uses?: string[];
  methods?: string[];
  resources?: string[];
  tools?: string[];
  consequenceClasses?: string[];
  maxBudget?: Budget;
}

export interface MandateApproval {
  requiredForConsequences?: string[];
  requiredAboveBudget?: Budget;
  approver?: string;
  escalationUrl?: string;
}

export interface MandateEvidenceRequirement {
  events?: string[];
  receiptRequired?: boolean;
  policyHashRequired?: boolean;
  paymentReceiptRequired?: boolean;
}

export interface MandateRevocation {
  url?: string;
  contact?: string;
}

export interface AgentMandate {
  id: string;
  subject: MandateSubject;
  delegator: MandateDelegator;
  scope: MandateScope;
  expiresAt: string;
  approval?: MandateApproval;
  evidence?: MandateEvidenceRequirement;
  revocation?: MandateRevocation;
}

export interface MandateDocument {
  version: "0.1";
  protocol: "open-agent-access";
  kind: "agent-mandates";
  issuer: {
    name: string;
    origin: string;
    contact?: string;
  };
  mandates: AgentMandate[];
}

export interface MandateEvaluationInput {
  agentId: string;
  principal?: string;
  operator?: string;
  purpose: string;
  use?: string;
  method?: string;
  url?: string;
  tool?: string;
  consequence?: string;
  budget?: Budget;
  now?: Date;
}

export interface MandateEvaluationResult {
  decision: MandateDecision;
  mandate?: AgentMandate;
  mandateHash?: string;
  reason: string;
  requiredEvidence?: MandateEvidenceRequirement;
  escalationUrl?: string;
}

const budgetSchema = z.object({
  amount: z.string().min(1),
  currency: z.string().min(1)
});

export const mandateDocumentSchema = z.object({
  version: z.literal("0.1"),
  protocol: z.literal("open-agent-access"),
  kind: z.literal("agent-mandates"),
  issuer: z.object({
    name: z.string().min(1),
    origin: z.string().url(),
    contact: z.string().optional()
  }),
  mandates: z.array(z.object({
    id: z.string().min(1),
    subject: z.object({
      agentId: z.string().min(1),
      principal: z.string().optional(),
      operator: z.string().optional()
    }),
    delegator: z.object({
      id: z.string().min(1),
      name: z.string().optional(),
      contact: z.string().optional()
    }),
    scope: z.object({
      purposes: z.array(z.string().min(1)).min(1),
      uses: z.array(z.string().min(1)).optional(),
      methods: z.array(z.string().min(1)).optional(),
      resources: z.array(z.string().min(1)).optional(),
      tools: z.array(z.string().min(1)).optional(),
      consequenceClasses: z.array(z.string().min(1)).optional(),
      maxBudget: budgetSchema.optional()
    }),
    expiresAt: z.string().min(1),
    approval: z.object({
      requiredForConsequences: z.array(z.string()).optional(),
      requiredAboveBudget: budgetSchema.optional(),
      approver: z.string().optional(),
      escalationUrl: z.string().url().optional()
    }).optional(),
    evidence: z.object({
      events: z.array(z.string()).optional(),
      receiptRequired: z.boolean().optional(),
      policyHashRequired: z.boolean().optional(),
      paymentReceiptRequired: z.boolean().optional()
    }).optional(),
    revocation: z.object({
      url: z.string().url().optional(),
      contact: z.string().optional()
    }).optional()
  }))
});

export function validateMandateDocument(input: unknown): MandateDocument {
  return mandateDocumentSchema.parse(input);
}

export function mandateHash(mandate: AgentMandate): string {
  return hashCanonicalJson(mandate);
}

export function evaluateMandate(document: MandateDocument, input: MandateEvaluationInput): MandateEvaluationResult {
  for (const mandate of document.mandates) {
    const subjectReason = subjectMismatch(mandate, input);
    if (subjectReason) {
      continue;
    }

    const expired = Date.parse(mandate.expiresAt) <= (input.now ?? new Date()).getTime();
    if (expired) {
      return withMandate("expired", mandate, "mandate_expired");
    }

    const scopeReason = scopeMismatch(mandate, input);
    if (scopeReason) {
      return withMandate("deny", mandate, scopeReason);
    }

    if (approvalRequired(mandate, input)) {
      return withMandate("needs_approval", mandate, "approval_required", mandate.approval?.escalationUrl);
    }

    return withMandate("allow", mandate, "mandate_allows");
  }

  return { decision: "deny", reason: "no_matching_mandate" };
}

export function buildMandateReceiptContext(result: MandateEvaluationResult) {
  if (!result.mandate) {
    return undefined;
  }
  return {
    mandateId: result.mandate.id,
    mandateHash: result.mandateHash,
    decision: result.decision,
    reason: result.reason,
    delegator: result.mandate.delegator.id,
    expiresAt: result.mandate.expiresAt
  };
}

export function createMandateAgentIdentity(mandate: AgentMandate): AgentIdentity {
  return {
    id: mandate.subject.agentId,
    operator: mandate.subject.operator,
    principal: mandate.subject.principal
  };
}

function withMandate(decision: MandateDecision, mandate: AgentMandate, reason: string, escalationUrl?: string): MandateEvaluationResult {
  return {
    decision,
    mandate,
    mandateHash: mandateHash(mandate),
    reason,
    requiredEvidence: mandate.evidence,
    escalationUrl
  };
}

function subjectMismatch(mandate: AgentMandate, input: MandateEvaluationInput): string | undefined {
  if (mandate.subject.agentId !== input.agentId) {
    return "agent_id_mismatch";
  }
  if (mandate.subject.principal && mandate.subject.principal !== input.principal) {
    return "principal_mismatch";
  }
  if (mandate.subject.operator && mandate.subject.operator !== input.operator) {
    return "operator_mismatch";
  }
  return undefined;
}

function scopeMismatch(mandate: AgentMandate, input: MandateEvaluationInput): string | undefined {
  if (!mandate.scope.purposes.includes(input.purpose)) {
    return "purpose_out_of_scope";
  }
  if (input.use && mandate.scope.uses && !mandate.scope.uses.includes(input.use)) {
    return "use_out_of_scope";
  }
  if (input.method && mandate.scope.methods && !mandate.scope.methods.map((method) => method.toUpperCase()).includes(input.method.toUpperCase())) {
    return "method_out_of_scope";
  }
  if (input.tool && mandate.scope.tools && !mandate.scope.tools.includes(input.tool)) {
    return "tool_out_of_scope";
  }
  if (input.consequence && mandate.scope.consequenceClasses && !mandate.scope.consequenceClasses.includes(input.consequence)) {
    return "consequence_out_of_scope";
  }
  if (input.url && mandate.scope.resources && !mandate.scope.resources.some((pattern) => resourceMatches(pattern, input.url as string))) {
    return "resource_out_of_scope";
  }
  if (input.budget && mandate.scope.maxBudget && !budgetWithin(input.budget, mandate.scope.maxBudget)) {
    return "budget_out_of_scope";
  }
  return undefined;
}

function approvalRequired(mandate: AgentMandate, input: MandateEvaluationInput): boolean {
  if (input.consequence && mandate.approval?.requiredForConsequences?.includes(input.consequence)) {
    return true;
  }
  if (input.budget && mandate.approval?.requiredAboveBudget && !budgetWithin(input.budget, mandate.approval.requiredAboveBudget)) {
    return true;
  }
  return false;
}

function budgetWithin(input: Budget, ceiling: Budget): boolean {
  if (input.currency.toUpperCase() !== ceiling.currency.toUpperCase()) {
    return false;
  }
  return Number(input.amount) <= Number(ceiling.amount);
}

function resourceMatches(pattern: string, url: string): boolean {
  if (pattern.startsWith("http://") || pattern.startsWith("https://")) {
    const candidate = new URL(url);
    const resource = new URL(pattern.replace("/**", "/__oaa_placeholder__"));
    if (candidate.origin !== resource.origin) {
      return false;
    }
    const originalPath = pattern.slice(resource.origin.length);
    return pathMatches(originalPath || "/", candidate.pathname);
  }
  return pathMatches(pattern, new URL(url).pathname);
}
