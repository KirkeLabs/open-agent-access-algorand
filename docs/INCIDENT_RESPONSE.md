# Incident And Revocation Workflows

Open Agent Access supports machine-readable emergency stop signals. This makes
shutdown and revocation operational instead of burying them in prose.

Recommended public path:

```text
/.well-known/agent-stop
```

## CLI

```sh
pnpm oaa incident stop \
  --output agent-stop.json \
  --reason incident_response \
  --paths '/premium/**' \
  --retry-after 300

pnpm oaa incident check agent-stop.json --path /premium/report --purpose research
```

`incident check` exits with code `2` when the supplied request would be stopped.

## Hono Enforcement

```ts
app.use("*", agentAccessMiddleware({
  policyPath: "./agent-access.json",
  emergencyStopPath: "./agent-stop.json"
}));
```

When a matching stop signal is active, middleware returns `503`, sets
`AA-Emergency-Stop: true`, and includes `Retry-After` if the signal declares it.

## Scope

Stop signals can target:

- agent IDs
- purposes
- uses
- rule IDs
- path patterns

Signals can expire. Expired or inactive signals do not stop access.
