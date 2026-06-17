# @kirkelabs/open-agent-access-x402-bazaar

Bazaar discovery interoperability helpers for Open Agent Access and Algorand
x402 resources.

Bazaar helps facilitators catalogue x402-enabled paid resources. OAA adds the
policy, purpose, identity, receipt, and audit layer around those resources.

This package intentionally does not replace Bazaar or x402 AVM packages. It
exports plain JSON-compatible metadata that can be attached to Bazaar discovery
extensions, payment requirements, API manifests, or facilitator catalogues.

## Example

```ts
import {
  createBazaarDiscoveryFromOaaRule,
  attachOaaPolicyRefToBazaarExtension
} from "@kirkelabs/open-agent-access-x402-bazaar";

const discovery = createBazaarDiscoveryFromOaaRule(rule, {
  path: "/premium/report",
  method: "GET",
  policyUrl: "https://api.example/.well-known/agent-access.json",
  policyHash: "policy-hash",
  origin: "https://api.example"
});

const extensions = attachOaaPolicyRefToBazaarExtension(discovery, {
  policyUrl: "https://api.example/.well-known/agent-access.json",
  policyHash: "policy-hash",
  ruleId: rule.id,
  receiptRequired: true
});
```

## Boundary

- Bazaar answers: what paid x402 resources exist and how can a client call them?
- OAA answers: who may access this resource, for what purpose, under which
  terms, with what receipt and audit trail?

