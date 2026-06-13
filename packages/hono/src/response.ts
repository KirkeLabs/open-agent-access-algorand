import { buildSiteDecisionHeaders, type AgentAccessDecision, type AgentAccessRule } from "@kirkelabs/open-agent-access-core";

export function decisionStatus(decision: AgentAccessDecision): number {
  switch (decision) {
    case "allow":
      return 200;
    case "charge":
      return 402;
    case "throttle":
      return 429;
    case "deny":
      return 403;
    case "human_only":
      return 403;
    case "redirect_to_api":
      return 307;
    case "review":
    default:
      return 403;
  }
}

export function buildDecisionHeaders(input: {
  decision: AgentAccessDecision;
  policyRef?: string;
  traceId: string;
  rule?: AgentAccessRule;
  receiptId?: string;
  rateLimitLimit?: number;
  rateLimitRemaining?: number;
}) {
  return buildSiteDecisionHeaders({
    decision: input.decision,
    policyRef: input.policyRef,
    traceId: input.traceId,
    rateLimitLimit: input.rateLimitLimit,
    rateLimitRemaining: input.rateLimitRemaining,
    attributionRequired: input.rule?.attribution?.required,
    retention: input.rule?.retention?.maxAge,
    receiptId: input.receiptId
  });
}
