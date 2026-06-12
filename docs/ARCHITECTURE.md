# Architecture

Open Agent Access has six layers:

1. Policy discovery at `/.well-known/agent-access.json`.
2. Optional mandate discovery at `/.well-known/agent-mandates.json`.
3. Agent preflight for identity, purpose, use, budget, mandate authority, and local receipts.
4. Site middleware for policy enforcement, rate/load controls, 402 metadata, and site receipts.
5. Tool-boundary guards for MCP-style tool execution.
6. Optional payment adapters, starting with Algorand x402 TestNet.

The core package owns schema validation, matching, decisions, headers, budgets,
hashing, receipts, and event trails. Framework packages consume core decisions.
Mandate and MCP packages sit above core to enforce delegated authority before
tools or fetches run. Payment packages are optional and must never be required
for tests or free access.

Security-sensitive defaults:

- policies and individual rules can expire
- receipt appends are lock-protected and append-only
- event trails can be hash-chained and attached to receipts
- mandate evaluation fails closed when authority is missing, expired, or out of scope
- middleware rate limits before route work
- paid route fulfilment uses replay checks and in-memory idempotency locks
- 402 responses include a resource binding hash derived from method, URL, policy
  hash, rule ID, and trace ID
- payment libraries are dynamically loaded only when payment is explicitly enabled
