# @kirkelabs/open-agent-access-cloudflare

Cloudflare Worker adapter for Open Agent Access.

Workers should provide policy inline or from a bound asset/config source. Receipt
storage is injected through `receiptSink`, so deployments can use Durable
Objects, Queues, R2, D1, or external APIs.

```ts
import { withAgentAccessCloudflare } from "@kirkelabs/open-agent-access-cloudflare";
import policy from "./agent-access.json";

export default {
  fetch: withAgentAccessCloudflare({
    policy,
    receiptSink: async (receipt, env, ctx) => {
      ctx.waitUntil(env.RECEIPTS.put(receipt.receiptId, JSON.stringify(receipt)));
    }
  }, async () => Response.json({ ok: true }))
};
```
