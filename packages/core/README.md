# @kirkelabs/open-agent-access-core

Core TypeScript SDK for Open Agent Access.

Includes:

- policy discovery and validation
- route/method/purpose/use decisions
- agent and site headers
- budget checks
- JSONL receipt ledger
- receipt verification and digest export
- bilateral receipt reconciliation
- optional Ed25519 receipt signatures
- policy linting

```ts
import { createAgentAccessClient } from "@kirkelabs/open-agent-access-core";

const client = createAgentAccessClient({
  agent: {
    id: "did:web:agent.example#research-agent",
    name: "Research Agent",
    operator: "Example Labs"
  },
  ledger: { type: "jsonl", path: ".oaa/receipts.jsonl" }
});
```

Payment is never attempted unless explicitly enabled and the declared budget
allows the policy price.
