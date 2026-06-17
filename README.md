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

Add Open Agent Access to another repo:

```sh
npx @kirkelabs/open-agent-access init
```

Common variants:

```sh
npx @kirkelabs/open-agent-access init --template static-site --protected /essays
npx @kirkelabs/open-agent-access init --template hono --protected /premium/report
npx @kirkelabs/open-agent-access init --template algorand-x402 --protected /premium/report
```

The init command creates `.oaa/`, `agent-access.json`,
`.well-known/agent-access.json`, and `docs/agent-access.md`. It prints the
runtime packages to install for your framework.

Develop this repo locally:

```sh
corepack enable
pnpm install
pnpm build
pnpm test
pnpm test:vitest
pnpm lint
pnpm security:check
pnpm audit:prod
```

Validate a policy:

```sh
pnpm oaa policy validate examples/publisher-policy/agent-access.json
pnpm oaa policy lint examples/publisher-policy/agent-access.json
pnpm oaa policy explain examples/publisher-policy/agent-access.json https://publisher.example/archive/premium/report --purpose research --use ai-input
pnpm oaa policy init --template publisher --origin https://publisher.example --output /tmp/agent-access.json --force
```

See [Integration Guide](docs/INTEGRATION_GUIDE.md) for copy-paste setup paths
for static sites, Vercel/Next.js, Hono, Express, Fastify, Cloudflare Workers,
agent clients, and Algorand x402 paid routes.

See [Supply Chain Security](docs/SUPPLY_CHAIN_SECURITY.md) for release gates,
npm provenance, CodeQL, Dependency Review, OSSF Scorecard, Dependabot, and
CODEOWNERS guidance.

## Site Owner Quickstart

```ts
import { Hono } from "hono";
import { agentAccessMiddleware } from "@kirkelabs/open-agent-access-hono";

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

Paid routes fail closed by default. Do not trust raw `X-PAYMENT` headers unless
an upstream x402 verifier has already validated them.

## Agent Builder Quickstart

```ts
import { createAgentAccessClient } from "@kirkelabs/open-agent-access-core";

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
pnpm --filter @kirkelabs/open-agent-access-example-hono-free-and-paid-site dev
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
| Core SDK | `@kirkelabs/open-agent-access-core` | Supported |
| CLI | `@kirkelabs/open-agent-access-cli` / `pnpm oaa` | Supported |
| Hono middleware | `@kirkelabs/open-agent-access-hono` | Supported |
| Express middleware | `@kirkelabs/open-agent-access-express` | Supported |
| Fastify hook | `@kirkelabs/open-agent-access-fastify` | Supported |
| Cloudflare Workers | `@kirkelabs/open-agent-access-cloudflare` | Supported |
| Vercel/Next.js middleware | `@kirkelabs/open-agent-access-vercel` | Supported |
| Verifiable agent identity | `@kirkelabs/open-agent-access-identity`, `oaa identity keygen` | Supported |
| Mandate graphs | `@kirkelabs/open-agent-access-mandates` | Supported |
| MCP tool guard | `@kirkelabs/open-agent-access-mcp` | Supported |
| Enterprise controls | `@kirkelabs/open-agent-access-enterprise`, `oaa enterprise report` | Supported |
| Immutable evidence bundles | `@kirkelabs/open-agent-access-evidence`, `oaa evidence bundle` | Supported |
| Policy-as-code export | `@kirkelabs/open-agent-access-policy-as-code`, `oaa policy export` | Supported |
| Compliance mappings | `@kirkelabs/open-agent-access-compliance`, `oaa compliance map` | Supported |
| Incident stop signals | `@kirkelabs/open-agent-access-incident`, `oaa incident stop` | Supported |
| Creative rights passports | `@kirkelabs/open-agent-access-creative-rights` | Supported |
| VC-shaped agent passports | `@kirkelabs/open-agent-access-vc` | Supported |
| ODRL rights-policy mapping | `@kirkelabs/open-agent-access-odrl` | Supported |
| OpenAPI extensions | `@kirkelabs/open-agent-access-openapi` | Supported |
| OpenTelemetry export | `@kirkelabs/open-agent-access-otel` | Supported |
| Agent Card / tool manifest bindings | `@kirkelabs/open-agent-access-agent-card` | Supported |
| Industry profile templates | `@kirkelabs/open-agent-access-industry-profiles` | Supported |
| Policy signing | `@kirkelabs/open-agent-access-policy-signing` | Supported |
| Transparency logs | `@kirkelabs/open-agent-access-transparency` | Supported |
| Shared replay/idempotency | `@kirkelabs/open-agent-access-replay` | Supported |
| Security profiles | `@kirkelabs/open-agent-access-security-profiles` | Supported |
| Algorand anchoring | `@kirkelabs/open-agent-access-algorand-anchor` | Supported |
| Bazaar discovery interop | `@kirkelabs/open-agent-access-x402-bazaar` | Supported |
| Redis replay store | `@kirkelabs/open-agent-access-storage-redis` | Supported |
| Postgres replay store | `@kirkelabs/open-agent-access-storage-postgres` | Supported |
| Algorand x402 TestNet | `@kirkelabs/open-agent-access-payments-algorand-x402` | Adapter and fixtures supported |
| MainNet settlement | payment adapter roadmap | Planned |
| Conformance suite | `@kirkelabs/open-agent-access-conformance`, `oaa conformance run` | Supported |

The trust-passport example combines policy, mandate, claim provenance, and
agent-readable publishing metadata:

```sh
pnpm --filter @kirkelabs/open-agent-access-example-trust-passport-publisher dev
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
pnpm oaa policy export agent-access.json --format opa --output /tmp/oaa-opa
pnpm oaa x402 testnet-check --json
pnpm oaa compliance map --framework all --json
pnpm oaa incident stop --output agent-stop.json --reason incident_response --paths '/premium/**'
pnpm oaa identity keygen
```

The enterprise report scores fail-closed defaults, required identity/purpose,
receipt posture, paid-access controls, rate/load controls, policy expiry,
mandate revocation, and audit evidence.

## Ecosystem Adapter Framing

OAA is the policy, payment, and receipt rail. Adjacent standards and markets
should plug into that rail rather than being absorbed into the core protocol:

- RSL-style terms are external licensing signals.
- C2PA/content credentials are external provenance signals.
- Algorand provides settlement and optional receipt anchoring.
- Creative passports model rights-aware use cases for samples, stems, datasets,
  images, articles, and other assets.
- Marketplaces, rights societies, and collectives remain distribution and
  administration partners.

The `@kirkelabs/open-agent-access-creative-rights` package implements the first
slice of this adapter layer. It can validate a creative asset passport, convert
license options into OAA policy rules, and bind creative/provenance/registry
references into receipt evidence. It does not create copyright, prove final legal
ownership, replace PRS/PPL, operate a marketplace, or act as DRM.

See [Ecosystem Adapters](docs/ECOSYSTEM_ADAPTERS.md) and the
[creative passport example](examples/creative-passport/README.md).

OAA also ships interoperability adapters for VC-shaped agent passports,
ODRL-shaped rights policy mapping, and OpenAPI `x-open-agent-access`
extensions. See [Interoperability Profiles](docs/INTEROPERABILITY_PROFILES.md).

Hardening packages add signed policies, Merkle transparency proofs, shared
replay/idempotency helpers, named security profile checks, and Algorand anchor
payloads for policy/receipt/log digests.

For Algorand x402 resource discovery, Bazaar should be treated as a companion
layer rather than a competitor: Bazaar helps agents discover paid x402
resources; OAA binds those resources to policy, purpose, receipts, and audit
evidence. See [Bazaar Interoperability](docs/BAZAAR_INTEROP.md).

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
- [Policy As Code Export](docs/POLICY_AS_CODE.md)
- [Compliance Mappings](docs/COMPLIANCE_MAPPINGS.md)
- [Incident And Revocation Workflows](docs/INCIDENT_RESPONSE.md)
- [Architecture Decision Records](docs/ADRS.md)
- [Production Deployment](docs/PRODUCTION_DEPLOYMENT.md)
- [Confidence Checklist](docs/CONFIDENCE_CHECKLIST.md)
- [Machine-readable examples](examples/machine-readable/README.md)
- [Algorand x402](docs/ALGORAND_X402.md)
- [Algorand x402 Profile Spec](spec/algorand-x402-profile-v0.1.md)
- [Agent Mandates Spec](spec/agent-mandates-v0.1.md)
- [Threat Model](docs/THREAT_MODEL.md)
- [Kirke Labs Stewardship](docs/KIRKE_LABS.md)
