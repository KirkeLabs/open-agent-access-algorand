import type { AgentAccessPolicy, AgentAccessRule, PricePolicy } from "@kirkelabs/open-agent-access-core";

export interface AgentAccessManifestBinding {
  protocol: "open-agent-access";
  version: "0.1";
  policyUrl: string;
  mandateUrl?: string;
  receiptRequired?: boolean;
  paymentSupported?: boolean;
  algorandX402Supported?: boolean;
  contact?: string;
}

export interface AgentCardLike {
  name?: string;
  description?: string;
  url?: string;
  skills?: Array<{
    id?: string;
    name: string;
    description?: string;
    inputModes?: string[];
    outputModes?: string[];
    [key: string]: unknown;
  }>;
  capabilities?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface McpToolManifestLike {
  name: string;
  description?: string;
  inputSchema?: unknown;
  annotations?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ToolPolicyBinding {
  toolName: string;
  ruleId: string;
  path: string;
  purposes: string[];
  uses: string[];
  decision?: AgentAccessRule["decision"];
  price?: PricePolicy;
}

export function createAgentAccessManifestBinding(input: Omit<AgentAccessManifestBinding, "protocol" | "version">): AgentAccessManifestBinding {
  return {
    protocol: "open-agent-access",
    version: "0.1",
    ...input
  };
}

export function attachAgentAccessToAgentCard<T extends AgentCardLike>(
  card: T,
  binding: AgentAccessManifestBinding
): T & { "x-open-agent-access": AgentAccessManifestBinding } {
  return {
    ...card,
    "x-open-agent-access": binding,
    capabilities: {
      ...(card.capabilities ?? {}),
      openAgentAccess: {
        policyUrl: binding.policyUrl,
        mandateUrl: binding.mandateUrl,
        receiptRequired: binding.receiptRequired ?? true,
        paymentSupported: binding.paymentSupported ?? false,
        algorandX402Supported: binding.algorandX402Supported ?? false
      }
    }
  };
}

export function extractAgentAccessFromAgentCard(card: AgentCardLike): AgentAccessManifestBinding | undefined {
  const binding = card["x-open-agent-access"];
  return isBinding(binding) ? binding : undefined;
}

export function attachAgentAccessToMcpTool<T extends McpToolManifestLike>(
  tool: T,
  binding: ToolPolicyBinding
): T & { annotations: Record<string, unknown> & { openAgentAccess: ToolPolicyBinding } } {
  return {
    ...tool,
    annotations: {
      ...(tool.annotations ?? {}),
      openAgentAccess: binding
    }
  };
}

export function createToolPolicyBindingsPolicy(input: {
  siteName: string;
  origin: string;
  toolUrlBase?: string;
  bindings: ToolPolicyBinding[];
  contact?: string;
}): AgentAccessPolicy {
  const base = input.toolUrlBase ?? `${input.origin.replace(/\/$/, "")}/mcp/tools`;
  return {
    version: "0.1",
    protocol: "open-agent-access",
    site: {
      name: input.siteName,
      origin: input.origin,
      contact: input.contact
    },
    defaults: {
      decision: "review",
      respectRobotsTxt: true,
      requireAgentIdentity: true,
      requirePurpose: true,
      requireReceipt: true
    },
    rules: input.bindings.map((binding) => ({
      id: binding.ruleId,
      match: {
        methods: ["POST"],
        paths: [binding.path || `${new URL(base).pathname.replace(/\/$/, "")}/${encodeURIComponent(binding.toolName)}`]
      },
      decision: binding.decision ?? (binding.price ? "charge" : "allow"),
      purposes: binding.purposes,
      uses: binding.uses,
      price: binding.price,
      receipt: { required: true }
    })),
    receipt: { required: true }
  };
}

function isBinding(value: unknown): value is AgentAccessManifestBinding {
  return Boolean(value && typeof value === "object" && (value as AgentAccessManifestBinding).protocol === "open-agent-access");
}
