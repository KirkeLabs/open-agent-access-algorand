# @kirkelabs/open-agent-access-storage-redis

Redis replay-store adapter for paid-route replay protection.

```ts
import { agentAccessMiddleware } from "@kirkelabs/open-agent-access-hono";
import { createRedisReplayStore } from "@kirkelabs/open-agent-access-storage-redis";

app.use("*", agentAccessMiddleware({
  policyPath: "./agent-access.json",
  replayStore: createRedisReplayStore(redis),
  algorandX402: { enabled: true, payTo, facilitatorUrl, network: "testnet" }
}));
```

Bring your own Redis client. The adapter supports modern `{ PX: ttlMs }` clients
and classic `set(key, value, "PX", ttlMs)` clients.
