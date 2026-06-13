# @kirkelabs/open-agent-access-fastify

Fastify-compatible pre-handler hook for Open Agent Access.

```ts
import Fastify from "fastify";
import { createAgentAccessFastifyHook } from "@kirkelabs/open-agent-access-fastify";

const fastify = Fastify();

fastify.addHook("preHandler", createAgentAccessFastifyHook({
  policyPath: "./agent-access.json",
  receipts: { type: "jsonl", path: ".oaa/site-receipts.jsonl" }
}));
```

The hook uses structural types to avoid locking the package to one Fastify
version.
