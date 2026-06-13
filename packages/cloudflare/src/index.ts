import {
  enforceAgentAccess,
  hashPolicy,
  validateAgentAccessPolicy,
  type AgentAccessPolicy,
  type ReceiptRecord
} from "@kirkelabs/open-agent-access-core";

export interface CloudflareAgentAccessOptions<Env = unknown, Ctx = unknown> {
  policy: AgentAccessPolicy | unknown;
  policyUrl?: string;
  failMode?: "open" | "closed";
  receiptSink?: (receipt: ReceiptRecord, env: Env, ctx: Ctx) => void | Promise<void>;
}

export type CloudflareHandler<Env = unknown, Ctx = unknown> = (request: Request, env: Env, ctx: Ctx) => Response | Promise<Response>;

export function withAgentAccessCloudflare<Env = unknown, Ctx = unknown>(
  options: CloudflareAgentAccessOptions<Env, Ctx>,
  handler: CloudflareHandler<Env, Ctx>
): CloudflareHandler<Env, Ctx> {
  let cached: { policy: AgentAccessPolicy; policyHash: string } | undefined;

  function loadPolicy() {
    if (!cached) {
      const policy = validateAgentAccessPolicy(options.policy);
      cached = { policy, policyHash: hashPolicy(policy) };
    }
    return cached;
  }

  return async (request: Request, env: Env, ctx: Ctx) => {
    let loaded: { policy: AgentAccessPolicy; policyHash: string };
    try {
      loaded = loadPolicy();
    } catch (error) {
      if (options.failMode === "open") return handler(request, env, ctx);
      return Response.json({ error: "agent_access_policy_unavailable", message: (error as Error).message }, { status: 503 });
    }

    const result = enforceAgentAccess(loaded.policy, loaded.policyHash, {
      url: request.url,
      method: request.method,
      headers: request.headers
    }, { policyUrl: options.policyUrl });

    if (options.receiptSink) {
      const receipt: ReceiptRecord = {
        receiptVersion: "0.1",
        receiptType: "agent_access",
        receiptId: result.receiptId,
        timestamp: new Date().toISOString(),
        ...result.receipt
      };
      await options.receiptSink(receipt, env, ctx);
    }

    if (result.proceed) {
      const response = await handler(request, env, ctx);
      const headers = new Headers(response.headers);
      result.headers.forEach((value, key) => headers.set(key, value));
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    }

    return Response.json(result.body, {
      status: result.status ?? 403,
      headers: result.headers
    });
  };
}
