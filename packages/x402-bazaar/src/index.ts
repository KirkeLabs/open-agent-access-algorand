import {
  hashCanonicalJson,
  type AgentAccessPolicy,
  type AgentAccessRule
} from "@kirkelabs/open-agent-access-core";

export interface BazaarJsonSchema {
  type?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
  [key: string]: unknown;
}

export interface BazaarDiscoveryMetadata {
  description?: string;
  input?: unknown;
  inputSchema?: BazaarJsonSchema;
  bodyType?: "json" | "form-data" | "text" | "binary";
  toolName?: string;
  transport?: "streamable-http" | "sse";
  output?: {
    example?: unknown;
    schema?: BazaarJsonSchema;
  };
}

export interface OaaBazaarPolicyRef {
  protocol: "open-agent-access";
  version: "0.1";
  policyUrl: string;
  policyHash: string;
  ruleId?: string;
  decision: AgentAccessRule["decision"];
  purposes?: string[];
  uses?: string[];
  deniedUses?: string[];
  receiptRequired?: boolean;
  attributionRequired?: boolean;
  retention?: AgentAccessRule["retention"];
  paymentRequired: boolean;
  resourceBindingHash: string;
}

export interface OaaBazaarDiscovery extends BazaarDiscoveryMetadata {
  openAgentAccess: OaaBazaarPolicyRef;
}

export interface CreateBazaarDiscoveryOptions {
  policyUrl: string;
  policyHash?: string;
  policy?: AgentAccessPolicy;
  origin: string;
  method?: string;
  path?: string;
  toolName?: string;
  description?: string;
  input?: unknown;
  inputSchema?: BazaarJsonSchema;
  bodyType?: BazaarDiscoveryMetadata["bodyType"];
  transport?: BazaarDiscoveryMetadata["transport"];
  output?: BazaarDiscoveryMetadata["output"];
  receiptRequired?: boolean;
}

export interface BazaarResourceRoute {
  accepts: unknown;
  extensions: {
    bazaar?: OaaBazaarDiscovery;
    openAgentAccess?: OaaBazaarPolicyRef;
    [key: string]: unknown;
  };
}

export function createBazaarDiscoveryFromOaaRule(
  rule: AgentAccessRule,
  options: CreateBazaarDiscoveryOptions
): OaaBazaarDiscovery {
  const policyHash = options.policyHash ?? (options.policy ? hashCanonicalJson(options.policy) : undefined);
  if (!policyHash) throw new Error("policyHash or policy is required");
  const method = (options.method ?? rule.match?.methods?.[0] ?? "GET").toUpperCase();
  const path = options.path ?? rule.match?.paths?.[0] ?? "/";
  const policyRef = buildOaaX402BazaarMetadata({
    policyUrl: options.policyUrl,
    policyHash,
    rule,
    method,
    path,
    origin: options.origin,
    receiptRequired: options.receiptRequired
  });
  return {
    description: options.description ?? describeRule(rule),
    input: options.input,
    inputSchema: options.inputSchema,
    bodyType: options.bodyType,
    toolName: options.toolName,
    transport: options.transport,
    output: options.output,
    openAgentAccess: policyRef
  };
}

export function buildOaaX402BazaarMetadata(options: {
  policyUrl: string;
  policyHash: string;
  rule: AgentAccessRule;
  method?: string;
  path?: string;
  origin?: string;
  receiptRequired?: boolean;
}): OaaBazaarPolicyRef {
  const method = (options.method ?? options.rule.match?.methods?.[0] ?? "GET").toUpperCase();
  const path = options.path ?? options.rule.match?.paths?.[0] ?? "/";
  const url = options.origin ? new URL(path, options.origin).toString() : path;
  const receiptRequired = options.receiptRequired ?? options.rule.receipt?.required ?? options.rule.decision === "charge";
  const paymentRequired = options.rule.decision === "charge";
  return {
    protocol: "open-agent-access",
    version: "0.1",
    policyUrl: options.policyUrl,
    policyHash: options.policyHash,
    ruleId: options.rule.id,
    decision: options.rule.decision,
    purposes: options.rule.purposes,
    uses: options.rule.uses,
    deniedUses: options.rule.deniedUses,
    receiptRequired,
    attributionRequired: options.rule.attribution?.required,
    retention: options.rule.retention,
    paymentRequired,
    resourceBindingHash: hashCanonicalJson({
      method,
      url,
      policyHash: options.policyHash,
      ruleId: options.rule.id,
      decision: options.rule.decision
    })
  };
}

export function attachOaaPolicyRefToBazaarExtension(
  discovery: BazaarDiscoveryMetadata,
  policyRef: OaaBazaarPolicyRef
): OaaBazaarDiscovery {
  return {
    ...discovery,
    openAgentAccess: policyRef
  };
}

export function createBazaarResourceRoute(options: {
  accepts: unknown;
  discovery: OaaBazaarDiscovery;
  extraExtensions?: Record<string, unknown>;
}): BazaarResourceRoute {
  return {
    accepts: options.accepts,
    extensions: {
      ...options.extraExtensions,
      bazaar: options.discovery,
      openAgentAccess: options.discovery.openAgentAccess
    }
  };
}

export function extractOaaPolicyRefFromBazaarExtension(input: unknown): OaaBazaarPolicyRef | undefined {
  if (!input || typeof input !== "object") return undefined;
  const record = input as Record<string, unknown>;
  const direct = record.openAgentAccess;
  if (isOaaBazaarPolicyRef(direct)) return direct;
  const bazaar = record.bazaar;
  if (bazaar && typeof bazaar === "object" && isOaaBazaarPolicyRef((bazaar as Record<string, unknown>).openAgentAccess)) {
    return (bazaar as Record<string, OaaBazaarPolicyRef>).openAgentAccess;
  }
  return undefined;
}

export function createOaaRuleFromBazaarDiscovery(options: {
  id: string;
  match: AgentAccessRule["match"];
  discovery: OaaBazaarDiscovery;
  price?: AgentAccessRule["price"];
  payment?: AgentAccessRule["payment"];
}): AgentAccessRule {
  const ref = options.discovery.openAgentAccess;
  return {
    id: options.id,
    match: options.match,
    decision: ref.decision,
    purposes: ref.purposes,
    uses: ref.uses,
    deniedUses: ref.deniedUses,
    price: options.price,
    payment: options.payment,
    receipt: ref.receiptRequired ? { required: true } : undefined,
    attribution: ref.attributionRequired ? { required: true, format: "source-url" } : undefined,
    retention: ref.retention
  };
}

function describeRule(rule: AgentAccessRule) {
  const action = rule.decision === "charge" ? "Paid" : rule.decision;
  const uses = rule.uses?.length ? ` for ${rule.uses.join(", ")}` : "";
  return `${action} Open Agent Access resource${uses}`;
}

function isOaaBazaarPolicyRef(input: unknown): input is OaaBazaarPolicyRef {
  if (!input || typeof input !== "object") return false;
  const record = input as Partial<OaaBazaarPolicyRef>;
  return record.protocol === "open-agent-access"
    && record.version === "0.1"
    && typeof record.policyUrl === "string"
    && typeof record.policyHash === "string"
    && typeof record.resourceBindingHash === "string";
}
