# Bazaar Interoperability

Bazaar and Open Agent Access solve adjacent problems in the Algorand x402
stack.

```text
Bazaar: discover paid x402 resources.
OAA: decide who may access them, why, under which terms, with what receipt.
```

Bazaar discovery metadata helps facilitators catalogue x402-enabled APIs,
services, and MCP tools. OAA policy metadata helps agents and resource owners
bind that discovery to declared purpose, allowed uses, denied uses, attribution,
retention, receipts, policy hashes, and audit trails.

## Recommended Flow

```text
OAA policy rule
→ x402 payment requirement
→ Bazaar discovery metadata
→ facilitator catalogue
→ agent discovers resource
→ agent performs OAA preflight
→ x402 payment
→ OAA receipt
```

## Package

```sh
npm install @kirkelabs/open-agent-access-x402-bazaar
```

## Example

```ts
import {
  createBazaarDiscoveryFromOaaRule,
  createBazaarResourceRoute
} from "@kirkelabs/open-agent-access-x402-bazaar";

const discovery = createBazaarDiscoveryFromOaaRule(rule, {
  origin: "https://api.example",
  path: "/premium/report",
  method: "GET",
  policyUrl: "https://api.example/.well-known/agent-access.json",
  policyHash: "policy-hash",
  output: {
    example: { ok: true, report: "..." }
  }
});

const route = createBazaarResourceRoute({
  accepts,
  discovery
});
```

The resulting route object keeps Bazaar-compatible discovery data and an
`openAgentAccess` policy reference side by side.

## Boundary

OAA does not replace Bazaar, the AVM exact scheme, facilitators, x402 Hono/Express
middleware, or MCP payment wrappers. OAA should sit around them as the
policy/receipt layer.

