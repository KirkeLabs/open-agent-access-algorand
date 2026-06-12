# Open Agent Access Mandates v0.1

Mandates describe delegated authority for agent actions. They complement `/.well-known/agent-access.json`: a site policy says what a resource will accept, while a mandate says what an agent is authorised by its delegator to do.

Recommended well-known path:

```text
/.well-known/agent-mandates.json
```

Minimum fields:

- `issuer`: organisation publishing the mandate set.
- `subject`: agent identity, optional principal, optional operator.
- `delegator`: user, organisation, or system that authorised the action class.
- `scope`: purposes, uses, HTTP methods, resource URL/path patterns, tools, consequence classes, and max budget.
- `expiresAt`: mandatory expiry.
- `approval`: optional human approval requirements.
- `evidence`: required receipt and event evidence.
- `revocation`: contact or endpoint for stopping delegated authority.

Evaluation must fail closed when there is no matching mandate, the mandate has expired, scope does not match, or approval is required.
