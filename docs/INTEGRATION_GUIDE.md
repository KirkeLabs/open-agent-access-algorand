# Integration Guide

Open Agent Access should be installable from another repo without copying
internal source files.

## One Command

```sh
npx @kirkelabs/open-agent-access init
```

The CLI detects common frameworks when possible and creates:

- `.oaa/`
- `agent-access.json`
- `.well-known/agent-access.json`
- `docs/agent-access.md`

It never enables payment automatically and never creates real secrets.

## Static Site

```sh
npx @kirkelabs/open-agent-access init --template static-site --origin https://example.com --protected /essays
```

Use this for documentation sites, publisher sites, personal sites, and static
hosting. The generated policy is discoverable at
`/.well-known/agent-access.json`.

Static sites can demonstrate the agent-passport handshake. Real enforcement
belongs at middleware, edge, API gateway, or resource-server level.

## Hono

```sh
npx @kirkelabs/open-agent-access init --template hono --protected /premium/report
npm install @kirkelabs/open-agent-access-hono @kirkelabs/open-agent-access-core
```

```ts
import { agentAccessMiddleware } from "@kirkelabs/open-agent-access-hono";

app.use("*", agentAccessMiddleware({
  policyPath: "./agent-access.json",
  receipts: { type: "jsonl", path: ".oaa/site-receipts.jsonl" }
}));
```

## Express

```sh
npx @kirkelabs/open-agent-access init --template express --protected /premium/report
npm install @kirkelabs/open-agent-access-express @kirkelabs/open-agent-access-core
```

```ts
import { agentAccessExpressMiddleware } from "@kirkelabs/open-agent-access-express";

app.use(agentAccessExpressMiddleware({
  policyPath: "./agent-access.json",
  receipts: { type: "jsonl", path: ".oaa/site-receipts.jsonl" }
}));
```

## Fastify

```sh
npx @kirkelabs/open-agent-access init --template fastify --protected /premium/report
npm install @kirkelabs/open-agent-access-fastify @kirkelabs/open-agent-access-core
```

```ts
import { createAgentAccessFastifyHook } from "@kirkelabs/open-agent-access-fastify";

fastify.addHook("preHandler", createAgentAccessFastifyHook({
  policyPath: "./agent-access.json",
  receipts: { type: "jsonl", path: ".oaa/site-receipts.jsonl" }
}));
```

## Cloudflare Workers

```sh
npx @kirkelabs/open-agent-access init --template cloudflare --protected /premium/report
npm install @kirkelabs/open-agent-access-cloudflare @kirkelabs/open-agent-access-core
```

```ts
import { withAgentAccessCloudflare } from "@kirkelabs/open-agent-access-cloudflare";

export default {
  fetch: withAgentAccessCloudflare({
    policyPath: "./agent-access.json"
  }, async () => new Response("ok"))
};
```

## Agent Client

```sh
npx @kirkelabs/open-agent-access init --template agent-client
npm install @kirkelabs/open-agent-access-core
```

```ts
import { createAgentAccessClient } from "@kirkelabs/open-agent-access-core";

const client = createAgentAccessClient({
  agent: {
    id: "did:web:agent.example#research-agent",
    name: "Example Research Agent",
    operator: "Example Labs",
    contact: "mailto:agents@example.com"
  },
  ledger: { type: "jsonl", path: ".oaa/receipts.jsonl" }
});
```

## Algorand x402 Paid Route

```sh
npx @kirkelabs/open-agent-access init --template algorand-x402 --protected /premium/report
npm install @kirkelabs/open-agent-access-hono @kirkelabs/open-agent-access-payments-algorand-x402
```

The generated `.env.example` includes:

```sh
AVM_MNEMONIC=
AVM_ADDRESS=
FACILITATOR_URL=https://facilitator.goplausible.xyz
USDC_TESTNET_ASA_ID=
OAA_PAYMENTS_ENABLED=false
```

Payments are disabled by default. Local mnemonic loading is for TestNet
development only. Production systems should use wallet integration, KMS,
smart-wallet delegation, Liquid Auth, or another secure signing flow.

## Verify An Integration

```sh
npx @kirkelabs/open-agent-access policy validate agent-access.json
npx @kirkelabs/open-agent-access check https://example.com/protected --purpose research --use summarize
npx @kirkelabs/open-agent-access receipts verify .oaa/receipts.jsonl
```

## Package Boundary

Use `@kirkelabs/open-agent-access` for onboarding and CLI commands. Use scoped packages for
runtime code:

- `@kirkelabs/open-agent-access-core`
- `@kirkelabs/open-agent-access-hono`
- `@kirkelabs/open-agent-access-express`
- `@kirkelabs/open-agent-access-fastify`
- `@kirkelabs/open-agent-access-cloudflare`
- `@kirkelabs/open-agent-access-payments-algorand-x402`
- `@kirkelabs/open-agent-access-identity`
- `@kirkelabs/open-agent-access-mandates`
- `@kirkelabs/open-agent-access-evidence`
- `@kirkelabs/open-agent-access-enterprise`
