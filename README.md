# Open Agent Access for Algorand

Open Agent Access for Algorand is a practical operating layer for the
agent-readable web.

A Kirke Labs open infrastructure project.

Agents should not blindly scrape or hammer sites. Sites should not have to
choose between blocking all agents or being abused. Open Agent Access gives both
sides a handshake:

```text
agent intent -> mandate check -> policy discovery -> permission decision
-> rate/load/value terms -> optional Algorand x402 payment
-> bilateral access receipt -> provenance log
```

Built for the Algorand community, but designed as open infrastructure for the
wider agent-readable web.

## What It Is

Open Agent Access is:

- robots.txt for reciprocal agent access, with value exchange
- a handshake layer for the agent-readable web
- a neutral access-control and receipt layer for agents, sites, APIs, MCP tools, and paid content
- an open-source Algorand-first implementation of authorised agent access with x402 settlement
- a mandate and event-trail layer for agents that need delegated authority across fetches, API calls, and tool use

Open Agent Access is not a crawler, scraping tool, bypass tool, DRM system, pure
audit logger, pure payment wrapper, or runtime-specific agent framework.

## Why Algorand

Algorand is well-suited for high-frequency, low-value agentic payments: fast
finality, low fees, and a strong developer ecosystem. This repo makes Algorand
x402 first-class while keeping the protocol modular so other payment adapters can
be added later.

## Quickstart

```sh
corepack enable
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm security:check
```

Validate a policy:

```sh
pnpm oaa policy validate examples/publisher-policy/agent-access.json
pnpm oaa policy lint examples/publisher-policy/agent-access.json
pnpm oaa policy explain examples/publisher-policy/agent-access.json https://publisher.example/archive/premium/report --purpose research --use ai-input
pnpm oaa policy init --template publisher --origin https://publisher.example --output /tmp/agent-access.json --force
```

## Site Owner Quickstart

```ts
import { Hono } from "hono";
import { agentAccessMiddleware } from "@open-agent-access/hono";

const app = new Hono();

app.use("*", agentAccessMiddleware({
  policyPath: "./agent-access.json",
  receipts: { type: "jsonl", path: ".oaa/site-receipts.jsonl" },
  algorandX402: {
    enabled: true,
    payTo: process.env.AVM_ADDRESS,
    facilitatorUrl: process.env.FACILITATOR_URL || "https://facilitator.goplausible.xyz",
    network: "testnet"
  }
}));
```

Expose your policy at `/.well-known/agent-access.json`. For delegated
authority, also expose a mandate document at
`/.well-known/agent-mandates.json`.

## Agent Builder Quickstart

```ts
import { createAgentAccessClient } from "@open-agent-access/core";

const client = createAgentAccessClient({
  agent: {
    id: "did:web:agent.example#research-agent",
    name: "Example Research Agent",
    operator: "Example Labs",
    principal: "user:steve@example.com",
    contact: "mailto:agents@example.com"
  },
  ledger: { type: "jsonl", path: ".oaa/receipts.jsonl" },
  payments: {
    algorandX402: { enabled: true, network: "testnet", mnemonicEnv: "AVM_MNEMONIC" }
  }
});

await client.fetch("https://example.com/premium/report", {
  purpose: "research",
  use: "ai-input",
  budget: { amount: "0.05", currency: "USD" }
});
```

## Algorand TestNet x402 Quickstart

Create `.env` locally from `.env.example` and set:

```sh
AVM_MNEMONIC=
AVM_ADDRESS=
FACILITATOR_URL=https://facilitator.goplausible.xyz
USDC_TESTNET_ASA_ID=
```

Never commit mnemonics, private keys, or seed phrases. For production, use wallet
integration, KMS, smart-wallet delegation, Liquid Auth, or another secure signing
flow. Mnemonic env loading is for local TestNet development only.

## Run Examples

```sh
pnpm --filter @open-agent-access/example-hono-free-and-paid-site dev
pnpm oaa check http://localhost:4021/free --purpose research --use read
pnpm oaa fetch http://localhost:4021/free --purpose research --use read
pnpm oaa check http://localhost:4021/premium/report --purpose research --use ai-input --budget USD:0.05
pnpm oaa fetch http://localhost:4021/premium/report --purpose research --use ai-input --budget USD:0.05
```

Premium fetches show payment-required metadata and do not pay unless `--pay` or
`OAA_PAYMENTS_ENABLED=true` is set.

## Integration Matrix

| Area | Package / Command | Status |
| --- | --- | --- |
| Core SDK | `@open-agent-access/core` | Supported |
| CLI | `@open-agent-access/cli` / `pnpm oaa` | Supported |
| Hono middleware | `@open-agent-access/hono` | Supported |
| Express middleware | `@open-agent-access/express` | Supported |
| Fastify hook | `@open-agent-access/fastify` | Supported |
| Cloudflare Workers | `@open-agent-access/cloudflare` | Supported |
| Verifiable agent identity | `@open-agent-access/identity`, `oaa identity keygen` | Supported |
| Mandate graphs | `@open-agent-access/mandates` | Supported |
| MCP tool guard | `@open-agent-access/mcp` | Supported |
| Enterprise controls | `@open-agent-access/enterprise`, `oaa enterprise report` | Supported |
| Immutable evidence bundles | `@open-agent-access/evidence`, `oaa evidence bundle` | Supported |
| Redis replay store | `@open-agent-access/storage-redis` | Supported |
| Postgres replay store | `@open-agent-access/storage-postgres` | Supported |
| Algorand x402 TestNet | `@open-agent-access/payments-algorand-x402` | Adapter and fixtures supported |
| MainNet settlement | payment adapter roadmap | Planned |
| Conformance suite | `@open-agent-access/conformance`, `oaa conformance run` | Supported |

The trust-passport example combines policy, mandate, claim provenance, and
agent-readable publishing metadata:

```sh
pnpm --filter @open-agent-access/example-trust-passport-publisher dev
```

## Verify Receipts

```sh
pnpm oaa receipts verify .oaa/receipts.jsonl
pnpm oaa receipts digest .oaa/receipts.jsonl
pnpm oaa receipts inspect .oaa/receipts.jsonl
pnpm oaa receipts reconcile .oaa/receipts.jsonl .oaa/site-receipts.jsonl
```

## Enterprise Readiness

```sh
pnpm oaa enterprise report --policy agent-access.json --mandates agent-mandates.json --ledger .oaa/receipts.jsonl
pnpm oaa enterprise export-audit .oaa/receipts.jsonl --format otel --redact
pnpm oaa enterprise export-audit .oaa/receipts.jsonl --format cef --redact --strict
pnpm oaa evidence bundle --policy agent-access.json --mandates agent-mandates.json --ledger .oaa/receipts.jsonl --output oaa-evidence-bundle.json
pnpm oaa identity keygen
```

The enterprise report scores fail-closed defaults, required identity/purpose,
receipt posture, paid-access controls, rate/load controls, policy expiry,
mandate revocation, and audit evidence.

## Safety Principles

- respect site policy and robots.txt
- rate limit before expensive work
- never pay without explicit caller opt-in and budget allowance
- bind receipts to method, URL, policy hash, and trace ID
- bind event trails to receipts when source retrieval, mandate checks, tool
  calls, settlement, publication, rollback, or correction need reconstruction
- bind payment prompts to method, URL, policy hash, rule ID, and trace ID
- reject repeated paid proof metadata with a replay cache
- use idempotency keys and route locks for paid fulfilment paths
- never log mnemonics, private keys, or seed phrases
- keep payment metadata PII-safe where possible
- run CI checks for TypeScript, tests, lint, and common secret patterns

## Contributing

Algorand builders, publisher engineers, agent runtime maintainers, MCP tool
authors, and protocol reviewers are welcome. Good starting labels include
`good first issue`, `algorand`, `x402`, `policy-spec`, `receipts`,
`middleware`, `agent-client`, `security`, and `docs`.

## More Docs

- [Architecture](docs/ARCHITECTURE.md)
- [API Reference](docs/API_REFERENCE.md)
- [Header Registry](docs/HEADER_REGISTRY.md)
- [Verifiable Agent Identity](docs/AGENT_IDENTITY.md)
- [Mandates](docs/MANDATES.md)
- [Trust Passports](docs/TRUST_PASSPORT.md)
- [Enterprise Readiness](docs/ENTERPRISE_READINESS.md)
- [Immutable Evidence Storage](docs/IMMUTABLE_EVIDENCE.md)
- [Architecture Decision Records](docs/ADRS.md)
- [Production Deployment](docs/PRODUCTION_DEPLOYMENT.md)
- [Confidence Checklist](docs/CONFIDENCE_CHECKLIST.md)
- [Machine-readable examples](examples/machine-readable/README.md)
- [Algorand x402](docs/ALGORAND_X402.md)
- [Algorand x402 Profile Spec](spec/algorand-x402-profile-v0.1.md)
- [Agent Mandates Spec](spec/agent-mandates-v0.1.md)
- [Threat Model](docs/THREAT_MODEL.md)
- [Kirke Labs Stewardship](docs/KIRKE_LABS.md)
