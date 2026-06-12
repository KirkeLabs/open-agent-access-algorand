# Architecture

Open Agent Access has seven layers:

1. Policy discovery at `/.well-known/agent-access.json`.
2. Optional verifiable agent identity using signed agent access headers.
3. Optional mandate discovery at `/.well-known/agent-mandates.json`.
4. Agent preflight for identity, purpose, use, budget, mandate authority, and local receipts.
5. Site middleware for policy enforcement, rate/load controls, 402 metadata, and site receipts.
6. Tool-boundary guards for MCP-style tool execution.
7. Enterprise posture, risk, audit export, evidence digest, immutable bundle, and policy-as-code tooling.
8. Optional payment adapters, starting with Algorand x402 TestNet.

The core package owns schema validation, matching, decisions, headers, budgets,
hashing, receipts, and event trails. Framework packages consume core decisions.
Mandate and MCP packages sit above core to enforce delegated authority before
tools or fetches run. The enterprise package turns policy, mandate, receipt,
and event evidence into control reports and SIEM/observability exports. Payment
packages are optional and must never be required for tests or free access.
The evidence package produces create-only manifests suitable for WORM storage or
Object Lock workflows.
The policy-as-code package projects OAA policy into OPA/Rego and Cedar-style
review artifacts for enterprise authorization programs.

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
