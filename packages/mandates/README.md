# @kirkelabs/open-agent-access-mandates

Mandate graph primitives for delegated agent authority.

Mandates answer the question policy alone cannot answer: who delegated this agent action, what tools and resources were in scope, when does the authority expire, what evidence must be produced, and when is human approval required?

```ts
import { evaluateMandate, validateMandateDocument } from "@kirkelabs/open-agent-access-mandates";

const mandate = validateMandateDocument(document);
const result = evaluateMandate(mandate, {
  agentId: "did:web:agent.example#research",
  principal: "user:steve@example.com",
  purpose: "research",
  use: "ai-input",
  method: "GET",
  url: "https://publisher.example/premium/report",
  tool: "fetch",
  consequence: "paid-read",
  now: new Date()
});
```

The evaluator fails closed for missing identity, expired mandates, out-of-scope resources, unapproved tools, consequence class mismatches, and approval thresholds.
