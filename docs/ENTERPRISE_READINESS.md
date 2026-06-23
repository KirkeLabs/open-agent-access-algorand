# Enterprise Readiness

Open Agent Access can be deployed as an enterprise control layer for agent
access, tool use, paid resources, and audit evidence.

The enterprise package and CLI cover five operational needs:

- posture reporting for policy, mandates, and receipts
- risk scoring for consequential access attempts
- signed agent identity enforcement
- immutable evidence bundle manifests
- OPA/Rego and Cedar-style policy-as-code export
- compliance evidence mappings
- incident stop and revocation workflows
- privacy-safe audit redaction
- OpenTelemetry-style span export
- CEF/SIEM export
- human approval guardrails for agent-driven repository and deployment actions

## CLI

```sh
pnpm oaa enterprise report \
  --policy examples/trust-passport-publisher/agent-access.json \
  --mandates examples/trust-passport-publisher/agent-mandates.json \
  --json

pnpm oaa enterprise export-audit .oaa/receipts.jsonl --format otel --redact
pnpm oaa enterprise export-audit .oaa/receipts.jsonl --format cef --redact --strict
pnpm oaa evidence bundle --policy agent-access.json --mandates agent-mandates.json --ledger .oaa/receipts.jsonl --output oaa-evidence-bundle.json
pnpm oaa policy export agent-access.json --format opa --output /tmp/oaa-opa
pnpm oaa x402 testnet-check --json
pnpm oaa compliance map --framework all --json
pnpm oaa incident stop --output agent-stop.json --reason incident_response --paths '/premium/**'
pnpm oaa identity keygen
pnpm oaa diff-packet --repo-path . --action git.push --output oaa-review.md
pnpm oaa approve git.push --repo-path . --note "Human reviewed the bounded diff packet" --ttl-minutes 30 --token-file .oaa/approval-token
pnpm oaa guard git.push --repo-path . --approval-token "$OAA_APPROVAL_TOKEN" --json
pnpm oaa github ruleset-template --branch main --checks CI,CodeQL --signed-commits
```

`report` returns a score, policy hash, optional mandate-document hash, evidence
bundle hash, and control findings. Error findings mean the deployment should not
be treated as enterprise-ready until corrected.

## Control Themes

- fail-closed defaults
- required agent identity and purpose
- required receipts
- security contact and review path
- policy expiry
- rate limits and emergency stop paths
- explicit paid-access price, payment, and receipt controls
- explicit AI-training posture
- mandate expiry, revocation, and evidence requirements
- payment settlement evidence in receipts
- one-time human approval tokens for production-facing agent actions
- freeze mode for incident response
- hash-chained approval ledgers for repo/deployment mutations

## Audit Exports

OpenTelemetry-style spans are intended for observability pipelines. CEF output
is intended for SIEM ingestion. Both support redaction:

- `pii-safe`: redact principal, contact, security contact, and payer values.
- `strict`: additionally redact URLs and pay-to values.

Redaction uses stable hashes so auditors can correlate repeated entities without
printing raw identifiers.

## Evidence Bundle Digest

Evidence bundle digests bind together:

- policy hash
- mandate document hash
- receipt hashes
- event hashes

This gives review teams a compact artifact for change records, customer
assurance, incident response, and later anchoring.

## Agent Action Approval

`@kirkelabs/open-agent-access-guard` adds a separate approval ledger for
agent-controlled repo and deployment actions. It is designed for cases where an
agent can inspect, summarize, and prepare changes, but must not silently push,
deploy, publish packages, mutate production env vars, change domains, alter
payment config, or deploy contracts.

The guard binds approval tokens to:

- action
- repo identity
- branch
- HEAD
- diff hash
- expiry
- one-time redemption

Use it with local hooks for developer ergonomics and with GitHub branch rulesets
or deployment protection for actual enforcement. See
[Agent Action Guard](AGENT_ACTION_GUARD.md).
