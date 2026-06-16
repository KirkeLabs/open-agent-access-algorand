# @kirkelabs/open-agent-access-hono

Hono middleware for Open Agent Access policy enforcement.

Includes:

- policy loading and validation
- agent access header inspection
- deterministic decision headers
- rate limiting before route work
- JSONL site receipts
- 402 payment metadata
- replay-store hook for paid routes
- in-memory replay store for development

```ts
import { Hono } from "hono";
import { agentAccessMiddleware } from "@kirkelabs/open-agent-access-hono";

const app = new Hono();

app.use("*", agentAccessMiddleware({
  policyPath: "./agent-access.json",
  receipts: { type: "jsonl", path: ".oaa/site-receipts.jsonl" }
}));
```

Use `@kirkelabs/open-agent-access-storage-redis` or
`@kirkelabs/open-agent-access-storage-postgres` for production replay protection.

## Paid Routes

The middleware fails closed for paid routes. A raw `X-PAYMENT` header does not
unlock access unless `algorandX402.trustPaymentHeader` is explicitly set. Use
that option only when an upstream x402 middleware, gateway, or test harness has
already verified the payment proof before OAA runs.

Direct internet-facing deployments should leave `trustPaymentHeader` unset or
`false`.
