# @kirkelabs/open-agent-access-storage-postgres

Postgres replay-store adapter for paid-route replay protection.

```ts
import { agentAccessMiddleware } from "@kirkelabs/open-agent-access-hono";
import {
  createPostgresReplayStore,
  createPostgresReplayTableSql
} from "@kirkelabs/open-agent-access-storage-postgres";

await pg.query(createPostgresReplayTableSql());

app.use("*", agentAccessMiddleware({
  policyPath: "./agent-access.json",
  replayStore: createPostgresReplayStore(pg),
  algorandX402: { enabled: true, payTo, facilitatorUrl, network: "testnet" }
}));
```

The client only needs a `query(sql, params)` method, so this works with `pg`,
pool wrappers, and most Postgres-compatible clients.
