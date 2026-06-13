import {
  appendReceipt,
  enforceAgentAccess,
  hashPolicy,
  readPolicyFile,
  type AgentAccessPolicy,
  type ReceiptLedgerOptions
} from "@kirkelabs/open-agent-access-core";

export interface FastifyLikeRequest {
  method: string;
  url: string;
  protocol?: string;
  hostname?: string;
  headers: Record<string, string | string[] | undefined>;
}

export interface FastifyLikeReply {
  header(name: string, value: string): FastifyLikeReply;
  code(statusCode: number): FastifyLikeReply;
  send(body: unknown): void;
}

export interface AgentAccessFastifyOptions {
  policyPath: string;
  policyUrl?: string;
  receipts?: ReceiptLedgerOptions;
  failMode?: "open" | "closed";
}

export function createAgentAccessFastifyHook(options: AgentAccessFastifyOptions) {
  let cached: { policy: AgentAccessPolicy; policyHash: string } | undefined;

  async function loadPolicy() {
    if (!cached) {
      const policy = await readPolicyFile(options.policyPath);
      cached = { policy, policyHash: hashPolicy(policy) };
    }
    return cached;
  }

  return async (request: FastifyLikeRequest, reply: FastifyLikeReply) => {
    let loaded: { policy: AgentAccessPolicy; policyHash: string };
    try {
      loaded = await loadPolicy();
    } catch (error) {
      if (options.failMode === "open") return;
      reply.code(503).send({ error: "agent_access_policy_unavailable", message: (error as Error).message });
      return;
    }

    const result = enforceAgentAccess(loaded.policy, loaded.policyHash, {
      url: buildFastifyUrl(request, loaded.policy.site.origin),
      method: request.method,
      headers: headersFromObject(request.headers)
    }, { policyUrl: options.policyUrl });

    result.headers.forEach((value, key) => reply.header(key, value));
    if (options.receipts) {
      await appendReceipt(options.receipts.path, {
        receiptVersion: "0.1",
        receiptType: "agent_access",
        receiptId: result.receiptId,
        ...result.receipt
      });
    }
    if (!result.proceed) {
      reply.code(result.status ?? 403).send(result.body);
    }
  };
}

function buildFastifyUrl(request: FastifyLikeRequest, fallbackOrigin: string) {
  const host = request.hostname ?? headerValue(request.headers.host);
  const protocol = request.protocol ?? "http";
  return host ? `${protocol}://${host}${request.url}` : `${fallbackOrigin}${request.url}`;
}

function headersFromObject(input: Record<string, string | string[] | undefined>) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) headers.set(key, value.join(", "));
    else if (value !== undefined) headers.set(key, value);
  }
  return headers;
}

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
