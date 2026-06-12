# Enterprise Readiness

Open Agent Access can be deployed as an enterprise control layer for agent
access, tool use, paid resources, and audit evidence.

The enterprise package and CLI cover five operational needs:

- posture reporting for policy, mandates, and receipts
- risk scoring for consequential access attempts
- signed agent identity enforcement
- immutable evidence bundle manifests
- privacy-safe audit redaction
- OpenTelemetry-style span export
- CEF/SIEM export

## CLI

```sh
pnpm oaa enterprise report \
  --policy examples/trust-passport-publisher/agent-access.json \
  --mandates examples/trust-passport-publisher/agent-mandates.json \
  --json

pnpm oaa enterprise export-audit .oaa/receipts.jsonl --format otel --redact
pnpm oaa enterprise export-audit .oaa/receipts.jsonl --format cef --redact --strict
pnpm oaa evidence bundle --policy agent-access.json --mandates agent-mandates.json --ledger .oaa/receipts.jsonl --output oaa-evidence-bundle.json
pnpm oaa identity keygen
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
