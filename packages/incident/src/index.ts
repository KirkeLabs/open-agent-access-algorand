import { pathMatches } from "@open-agent-access/core";
import { z } from "zod";

export interface AgentStopSignal {
  version: "0.1";
  protocol: "open-agent-access";
  kind: "agent-stop";
  active: boolean;
  issuedAt: string;
  expiresAt?: string;
  reason: string;
  message?: string;
  retryAfter?: number;
  contact?: string;
  scope?: {
    agentIds?: string[];
    purposes?: string[];
    uses?: string[];
    ruleIds?: string[];
    paths?: string[];
  };
}

export interface StopSignalEvaluationInput {
  agentId?: string;
  purpose?: string;
  use?: string;
  ruleId?: string;
  path?: string;
  now?: Date;
}

export interface StopSignalEvaluation {
  stopped: boolean;
  reason: string;
  retryAfter?: number;
  contact?: string;
}

export const agentStopSignalSchema = z.object({
  version: z.literal("0.1"),
  protocol: z.literal("open-agent-access"),
  kind: z.literal("agent-stop"),
  active: z.boolean(),
  issuedAt: z.string().min(1),
  expiresAt: z.string().optional(),
  reason: z.string().min(1),
  message: z.string().optional(),
  retryAfter: z.number().int().positive().optional(),
  contact: z.string().optional(),
  scope: z.object({
    agentIds: z.array(z.string()).optional(),
    purposes: z.array(z.string()).optional(),
    uses: z.array(z.string()).optional(),
    ruleIds: z.array(z.string()).optional(),
    paths: z.array(z.string()).optional()
  }).optional()
});

export function validateAgentStopSignal(input: unknown): AgentStopSignal {
  return agentStopSignalSchema.parse(input);
}

export function createAgentStopSignal(input: {
  active?: boolean;
  reason: string;
  message?: string;
  retryAfter?: number;
  contact?: string;
  scope?: AgentStopSignal["scope"];
  issuedAt?: Date;
  expiresAt?: string;
}): AgentStopSignal {
  return {
    version: "0.1",
    protocol: "open-agent-access",
    kind: "agent-stop",
    active: input.active ?? true,
    issuedAt: (input.issuedAt ?? new Date()).toISOString(),
    expiresAt: input.expiresAt,
    reason: input.reason,
    message: input.message,
    retryAfter: input.retryAfter,
    contact: input.contact,
    scope: input.scope
  };
}

export function evaluateStopSignal(signal: AgentStopSignal, input: StopSignalEvaluationInput): StopSignalEvaluation {
  const now = input.now ?? new Date();
  if (!signal.active) {
    return { stopped: false, reason: "stop_inactive" };
  }
  if (signal.expiresAt && Date.parse(signal.expiresAt) <= now.getTime()) {
    return { stopped: false, reason: "stop_expired" };
  }
  if (!scopeMatches(signal.scope, input)) {
    return { stopped: false, reason: "scope_not_matched" };
  }
  return {
    stopped: true,
    reason: signal.reason,
    retryAfter: signal.retryAfter,
    contact: signal.contact
  };
}

function scopeMatches(scope: AgentStopSignal["scope"], input: StopSignalEvaluationInput): boolean {
  if (!scope) return true;
  if (scope.agentIds && (!input.agentId || !scope.agentIds.includes(input.agentId))) return false;
  if (scope.purposes && (!input.purpose || !scope.purposes.includes(input.purpose))) return false;
  if (scope.uses && (!input.use || !scope.uses.includes(input.use))) return false;
  if (scope.ruleIds && (!input.ruleId || !scope.ruleIds.includes(input.ruleId))) return false;
  if (scope.paths && (!input.path || !scope.paths.some((pattern) => pathMatches(pattern, input.path as string)))) return false;
  return true;
}
