# Production Deployment

Open Agent Access v0.1 is designed to be safe by default, but production paid
resources need shared infrastructure.

## Required

- Run behind TLS.
- Keep payment disabled unless budget and signer controls are explicit.
- Do not trust raw `X-PAYMENT` headers on direct internet-facing routes.
- Use a shared replay store for multi-process or multi-region deployments.
- Require `AA-Idempotency-Key` or `Idempotency-Key` on paid high-cost routes.
- Rate-limit before expensive work.
- Keep receipt ledgers on durable storage.
- Run `pnpm security:check` and `pnpm audit:prod` in CI.

## Recommended Replay Store Contract

The Hono adapter accepts:

```ts
interface ReplayStore {
  has(key: string): Promise<boolean> | boolean;
  set(key: string, ttlMs: number): Promise<void> | void;
}
```

Use Redis, Postgres, Cloudflare Durable Objects, or another shared store for
production. The built-in memory store is for examples, tests, and single-process
development only.

Official adapters:

- `@kirkelabs/open-agent-access-storage-redis`
- `@kirkelabs/open-agent-access-storage-postgres`
- `@kirkelabs/open-agent-access-express`
- `@kirkelabs/open-agent-access-fastify`
- `@kirkelabs/open-agent-access-cloudflare`

Redis:

```ts
import { createRedisReplayStore } from "@kirkelabs/open-agent-access-storage-redis";

agentAccessMiddleware({
  policyPath: "./agent-access.json",
  replayStore: createRedisReplayStore(redis)
});
```

Postgres:

```ts
import {
  createPostgresReplayStore,
  createPostgresReplayTableSql
} from "@kirkelabs/open-agent-access-storage-postgres";

await pg.query(createPostgresReplayTableSql());

agentAccessMiddleware({
  policyPath: "./agent-access.json",
  replayStore: createPostgresReplayStore(pg)
});
```

## Payment Signing

Mnemonic env loading is local TestNet-only. Production signers should use wallet
integration, KMS, smart-wallet delegation, Liquid Auth, or another explicit
authorization flow.

## Payment Verification

For Hono paid routes, `algorandX402.trustPaymentHeader` must remain `false`
unless a verified upstream x402 middleware or gateway has already validated the
payment proof. OAA will otherwise return `402 payment_verification_required`
instead of fulfilling the route.
