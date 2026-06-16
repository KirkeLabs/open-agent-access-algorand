import type {
  AgentAccessDecision,
  AgentAccessPolicy,
  AgentAccessRule,
  AttributionPolicy,
  PaymentPolicy,
  PricePolicy,
  RateLimitPolicy,
  ReceiptRequirement
} from "@kirkelabs/open-agent-access-core";

export interface OpenApiAgentAccessExtension {
  ruleId?: string;
  decision: AgentAccessDecision;
  purposes?: string[];
  deniedPurposes?: string[];
  uses?: string[];
  allowedUses?: string[];
  deniedUses?: string[];
  rateLimit?: RateLimitPolicy;
  attribution?: AttributionPolicy;
  price?: PricePolicy;
  payment?: PaymentPolicy;
  receipt?: ReceiptRequirement;
  reviewUrl?: string;
}

export interface OpenApiOperationObject {
  operationId?: string;
  summary?: string;
  description?: string;
  [key: string]: unknown;
  "x-open-agent-access"?: OpenApiAgentAccessExtension;
}

export interface OpenApiDocument {
  openapi: string;
  info: { title: string; version: string; [key: string]: unknown };
  servers?: Array<{ url: string; [key: string]: unknown }>;
  paths: Record<string, Record<string, OpenApiOperationObject | unknown>>;
  components?: Record<string, unknown>;
  [key: string]: unknown;
}

const HTTP_METHODS = new Set(["get", "put", "post", "delete", "options", "head", "patch", "trace"]);

export function createOpenApiAgentAccessExtension(input: OpenApiAgentAccessExtension): OpenApiAgentAccessExtension {
  return { ...input };
}

export function applyAgentAccessToOpenApiOperation(
  document: OpenApiDocument,
  input: {
    path: string;
    method: string;
    extension: OpenApiAgentAccessExtension;
  }
): OpenApiDocument {
  const clone = structuredClone(document) as OpenApiDocument;
  const method = input.method.toLowerCase();
  const pathItem = clone.paths[input.path] ?? {};
  const operation = isOperation(pathItem[method]) ? pathItem[method] as OpenApiOperationObject : {};
  operation["x-open-agent-access"] = createOpenApiAgentAccessExtension(input.extension);
  pathItem[method] = operation;
  clone.paths[input.path] = pathItem;
  return clone;
}

export function extractAgentAccessPolicyFromOpenApi(
  document: OpenApiDocument,
  options: {
    origin?: string;
    siteName?: string;
    contact?: string;
    terms?: string;
    defaultDecision?: AgentAccessDecision;
  } = {}
): AgentAccessPolicy {
  const origin = options.origin ?? firstServerOrigin(document) ?? "https://api.example";
  const rules: AgentAccessRule[] = [];

  for (const [openApiPath, pathItem] of Object.entries(document.paths ?? {})) {
    if (!pathItem || typeof pathItem !== "object") continue;
    for (const [method, maybeOperation] of Object.entries(pathItem as Record<string, unknown>)) {
      if (!HTTP_METHODS.has(method) || !isOperation(maybeOperation)) continue;
      const extension = maybeOperation["x-open-agent-access"];
      if (!extension) continue;
      rules.push(openApiExtensionToRule(openApiPath, method, maybeOperation, extension));
    }
  }

  return {
    version: "0.1",
    protocol: "open-agent-access",
    site: {
      name: options.siteName ?? document.info?.title ?? "OpenAPI service",
      origin,
      contact: options.contact,
      terms: options.terms
    },
    defaults: {
      decision: options.defaultDecision ?? "review",
      respectRobotsTxt: true,
      requireAgentIdentity: true,
      requirePurpose: true,
      requireReceipt: true
    },
    rules,
    receipt: { required: true }
  };
}

export function openApiPathToAgentAccessPath(path: string): string {
  return path.replace(/\{[^}]+\}/g, "*");
}

export function addAgentAccessSecurityScheme(document: OpenApiDocument): OpenApiDocument {
  const clone = structuredClone(document) as OpenApiDocument;
  clone.components = {
    ...(clone.components ?? {}),
    securitySchemes: {
      ...((clone.components?.securitySchemes as Record<string, unknown> | undefined) ?? {}),
      OpenAgentAccess: {
        type: "apiKey",
        in: "header",
        name: "AA-Agent-ID",
        description: "Open Agent Access passport headers. Include AA-Agent-ID, AA-Purpose, AA-Use, AA-Trace-ID, and related AA-* headers."
      }
    }
  };
  return clone;
}

function openApiExtensionToRule(
  openApiPath: string,
  method: string,
  operation: OpenApiOperationObject,
  extension: OpenApiAgentAccessExtension
): AgentAccessRule {
  return {
    id: extension.ruleId ?? operation.operationId ?? `${method}-${openApiPath.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
    match: {
      methods: [method.toUpperCase()],
      paths: [openApiPathToAgentAccessPath(openApiPath)]
    },
    decision: extension.decision,
    purposes: extension.purposes,
    deniedPurposes: extension.deniedPurposes,
    uses: extension.uses,
    allowedUses: extension.allowedUses,
    deniedUses: extension.deniedUses,
    rateLimit: extension.rateLimit,
    attribution: extension.attribution,
    price: extension.price,
    payment: extension.payment,
    receipt: extension.receipt ?? { required: true },
    reviewUrl: extension.reviewUrl
  };
}

function firstServerOrigin(document: OpenApiDocument): string | undefined {
  const url = document.servers?.[0]?.url;
  if (!url) return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

function isOperation(value: unknown): value is OpenApiOperationObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
