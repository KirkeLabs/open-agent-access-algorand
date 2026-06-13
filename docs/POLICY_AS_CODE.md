# Policy As Code Export

Open Agent Access policy JSON is the authoritative protocol artifact. Enterprise
teams often also need policy-as-code review surfaces for existing authorization
programs.

`@kirkelabs/open-agent-access-policy-as-code` exports:

- OPA/Rego bundle: `data.json`, `policy.rego`, and an input example.
- Cedar-style bundle: schema JSON and generated policy statements.

These exports are designed for review, mirroring, and integration testing. The
native OAA decision engine remains the conformance target.

## CLI

```sh
pnpm oaa policy export examples/publisher-policy/agent-access.json \
  --format opa \
  --output /tmp/oaa-opa

pnpm oaa policy export examples/publisher-policy/agent-access.json \
  --format cedar \
  --output /tmp/oaa-cedar
```

Each bundle includes the source `policyHash`, making generated policy artifacts
traceable to the OAA policy version that produced them.

## OPA Input Shape

```json
{
  "method": "GET",
  "path": "/docs/page",
  "purpose": "research",
  "use": "read",
  "agent": {
    "id": "did:web:agent.example"
  }
}
```

## Enterprise Use

Recommended uses:

- mirror OAA allow/deny/charge decisions into existing policy repositories
- review generated Rego/Cedar diffs in change management
- run OPA/Cedar test suites around high-risk rules
- bind exported artifacts to evidence bundles using `policyHash`
