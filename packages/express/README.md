# @kirkelabs/open-agent-access-express

Express-compatible middleware for Open Agent Access.

```ts
import express from "express";
import { agentAccessExpressMiddleware } from "@kirkelabs/open-agent-access-express";

const app = express();

app.use(agentAccessExpressMiddleware({
  policyPath: "./agent-access.json",
  receipts: { type: "jsonl", path: ".oaa/site-receipts.jsonl" }
}));
```

The package uses structural request/response types so it can work with Express
and Express-compatible frameworks without forcing a specific version.
