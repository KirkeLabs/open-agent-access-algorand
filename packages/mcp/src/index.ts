import {
  decideAccess,
  hashCanonicalJson,
  type AgentAccessPolicy,
  type AgentAccessRequest,
  type AgentAccessDecision,
  type DecisionResult
} from "@open-agent-access/core";
import {
  buildMandateReceiptContext,
  evaluateMandate,
  type MandateDocument,
  type MandateEvaluationResult
} from "@open-agent-access/mandates";

export interface McpToolInvocation {
  toolName: string;
  serverName?: string;
  input?: unknown;
  url?: string;
  method?: string;
  purpose: string;
  use?: string;
  agent: NonNullable<AgentAccessRequest["agent"]>;
  budget?: AgentAccessRequest["budget"];
  consequence?: string;
  now?: Date;
}

export interface McpToolAuthorization {
  allowed: boolean;
  status: AgentAccessDecision | "needs_approval";
  reason: string;
  policy: {
    decision: DecisionResult;
    policyHash: string;
    ruleId?: string;
  };
  mandate?: MandateEvaluationResult;
  receiptContext: {
    toolName: string;
    serverName?: string;
    policyHash: string;
    ruleId?: string;
    mandate?: ReturnType<typeof buildMandateReceiptContext>;
  };
}

export interface McpGuardOptions {
  policy: AgentAccessPolicy;
  mandateDocument?: MandateDocument;
  serverName?: string;
  toolUrlBase?: string;
}

export function createAgentAccessMcpToolGuard(options: McpGuardOptions) {
  return {
    authorize(invocation: McpToolInvocation) {
      return authorizeMcpToolInvocation(options, invocation);
    },
    wrapTool<TInput, TOutput>(
      toolName: string,
      handler: (input: TInput, authorization: McpToolAuthorization) => Promise<TOutput> | TOutput
    ) {
      return async (input: TInput, invocation: Omit<McpToolInvocation, "toolName" | "input">): Promise<TOutput> => {
        const authorization = authorizeMcpToolInvocation(options, { ...invocation, toolName, input });
        if (!authorization.allowed) {
          throw new McpToolAuthorizationError(authorization);
        }
        return handler(input, authorization);
      };
    }
  };
}

export function authorizeMcpToolInvocation(options: McpGuardOptions, invocation: McpToolInvocation): McpToolAuthorization {
  const url = invocation.url ?? buildToolUrl(options, invocation.toolName);
  const policyHash = hashCanonicalJson(options.policy);
  const decision = decideAccess(options.policy, {
    url,
    method: invocation.method ?? "POST",
    purpose: invocation.purpose,
    use: invocation.use,
    budget: invocation.budget,
    agent: invocation.agent,
    now: invocation.now
  });

  const mandate = options.mandateDocument
    ? evaluateMandate(options.mandateDocument, {
      agentId: invocation.agent.id,
      principal: invocation.agent.principal,
      operator: invocation.agent.operator,
      purpose: invocation.purpose,
      use: invocation.use,
      method: invocation.method ?? "POST",
      url,
      tool: invocation.toolName,
      consequence: invocation.consequence,
      budget: invocation.budget,
      now: invocation.now
    })
    : undefined;

  const mandateBlocks = mandate && mandate.decision !== "allow";
  const allowedByPolicy = decision.decision === "allow" || decision.decision === "charge";
  const allowed = allowedByPolicy && !mandateBlocks;
  const status = mandate?.decision === "needs_approval"
    ? "needs_approval"
    : mandateBlocks
      ? "deny"
      : decision.decision;

  return {
    allowed,
    status,
    reason: mandateBlocks ? mandate.reason : decision.reason,
    policy: {
      decision,
      policyHash,
      ruleId: decision.rule?.id
    },
    mandate,
    receiptContext: {
      toolName: invocation.toolName,
      serverName: invocation.serverName ?? options.serverName,
      policyHash,
      ruleId: decision.rule?.id,
      mandate: mandate ? buildMandateReceiptContext(mandate) : undefined
    }
  };
}

export class McpToolAuthorizationError extends Error {
  readonly authorization: McpToolAuthorization;

  constructor(authorization: McpToolAuthorization) {
    super(`Open Agent Access denied MCP tool call: ${authorization.reason}`);
    this.name = "McpToolAuthorizationError";
    this.authorization = authorization;
  }
}

function buildToolUrl(options: McpGuardOptions, toolName: string): string {
  const base = options.toolUrlBase ?? `https://mcp.local/${encodeURIComponent(options.serverName ?? "server")}`;
  return `${base.replace(/\/$/, "")}/tools/${encodeURIComponent(toolName)}`;
}
