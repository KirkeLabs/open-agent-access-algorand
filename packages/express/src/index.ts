import {
  appendReceipt,
  enforceAgentAccess,
  hashPolicy,
  readPolicyFile,
  type AgentAccessPolicy,
  type ReceiptLedgerOptions
} from "@kirkelabs/open-agent-access-core";

export interface ExpressLikeRequest {
  method: string;
  protocol?: string;
  originalUrl?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  get?(name: string): string | undefined;
}

export interface ExpressLikeResponse {
  status(code: number): ExpressLikeResponse;
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
}

export type ExpressLikeNext = () => void | Promise<void>;

export interface AgentAccessExpressOptions {
  policyPath: string;
  policyUrl?: string;
  receipts?: ReceiptLedgerOptions;
  failMode?: "open" | "closed";
}

export function agentAccessExpressMiddleware(options: AgentAccessExpressOptions) {
  let cached: { policy: AgentAccessPolicy; policyHash: string } | undefined;

  async function loadPolicy() {
    if (!cached) {
      const policy = await readPolicyFile(options.policyPath);
      cached = { policy, policyHash: hashPolicy(policy) };
    }
    return cached;
  }

  return async (req: ExpressLikeRequest, res: ExpressLikeResponse, next: ExpressLikeNext) => {
    let loaded: { policy: AgentAccessPolicy; policyHash: string };
    try {
      loaded = await loadPolicy();
    } catch (error) {
      if (options.failMode === "open") return next();
      res.status(503).json({ error: "agent_access_policy_unavailable", message: (error as Error).message });
      return;
    }

    const requestUrl = buildExpressUrl(req, loaded.policy.site.origin);
    const result = enforceAgentAccess(loaded.policy, loaded.policyHash, {
      url: requestUrl,
      method: req.method,
      headers: headersFromObject(req.headers)
    }, { policyUrl: options.policyUrl });

    result.headers.forEach((value, key) => res.setHeader(key, value));
    if (options.receipts) {
      await appendReceipt(options.receipts.path, {
        receiptVersion: "0.1",
        receiptType: "agent_access",
        receiptId: result.receiptId,
        ...result.receipt
      });
    }
    if (result.proceed) {
      await next();
      return;
    }
    res.status(result.status ?? 403).json(result.body);
  };
}

function buildExpressUrl(req: ExpressLikeRequest, fallbackOrigin: string) {
  const host = req.get?.("host") ?? headerValue(req.headers.host);
  const protocol = req.protocol ?? "http";
  const path = req.originalUrl ?? req.url ?? "/";
  return host ? `${protocol}://${host}${path}` : `${fallbackOrigin}${path}`;
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
