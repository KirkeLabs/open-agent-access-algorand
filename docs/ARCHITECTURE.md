# Architecture

Open Agent Access has nine layers:

1. Policy discovery at `/.well-known/agent-access.json`.
2. Optional verifiable agent identity using signed agent access headers.
3. Optional mandate discovery at `/.well-known/agent-mandates.json`.
4. Agent preflight for identity, purpose, use, budget, mandate authority, and local receipts.
5. Site middleware for policy enforcement, rate/load controls, 402 metadata, and site receipts.
6. Tool-boundary guards for MCP-style tool execution.
7. Enterprise posture, risk, audit export, evidence digest, immutable bundle, and policy-as-code tooling.
8. Optional payment adapters, starting with Algorand x402 TestNet.
9. Ecosystem adapters for adjacent licensing, provenance, and creative-rights
   systems without absorbing those systems into OAA core.

The core package owns schema validation, matching, decisions, headers, budgets,
hashing, receipts, and event trails. Framework packages consume core decisions.
The Hono, Express, Fastify, Cloudflare, and Vercel adapters provide route,
worker, or edge-middleware enforcement without changing the protocol surface.
Mandate and MCP packages sit above core to enforce delegated authority before
tools or fetches run. The enterprise package turns policy, mandate, receipt,
and event evidence into control reports and SIEM/observability exports. Payment
packages are optional and must never be required for tests or free access.
The evidence package produces create-only manifests suitable for WORM storage or
Object Lock workflows.
The policy-as-code package projects OAA policy into OPA/Rego and Cedar-style
review artifacts for enterprise authorization programs.
The ecosystem adapter packages keep OAA interoperable without bloating core:
creative-rights turns asset passport metadata into OAA policy and receipt
evidence; VC shapes agent passports for portable identity claims; ODRL maps
rights-style permissions, prohibitions, and duties; OpenAPI lets API teams
declare OAA policy on operations; OTel exports OAA receipts and decisions into
enterprise observability; Agent Card bindings advertise OAA policy from
agent/tool manifests; industry profiles provide conservative policy templates
for common sectors. These adapters deliberately do not make OAA a marketplace,
copyright registry, DRM system, legal ownership oracle, identity wallet, API
gateway, healthcare compliance platform, supply-chain ERP, or grid-control
system.

The hardening packages add verification layers around that rail: policy signing
protects policy authenticity; transparency logs make receipt and policy digests
provable; shared replay/idempotency helpers bind paid fulfilment to a resource;
security profiles turn deployment posture into named checks; Algorand anchoring
publishes digest commitments without placing private data on-chain.

Security-sensitive defaults:

- policies and individual rules can expire
- receipt appends are lock-protected and append-only
- event trails can be hash-chained and attached to receipts
- mandate evaluation fails closed when authority is missing, expired, or out of scope
- enterprise audit exports can redact sensitive identifiers while preserving
  stable correlation hashes
- evidence bundle writes are designed for create-only storage; overwrites should
  fail
- Hono middleware can require signed agent identity before policy decisions run
- Hono middleware can enforce active emergency stop signals before route work
- middleware rate limits before route work
- paid route fulfilment uses replay checks and in-memory idempotency locks
- 402 responses include a resource binding hash derived from method, URL, policy
  hash, rule ID, and trace ID
- payment libraries are dynamically loaded only when payment is explicitly enabled
