# Changelog

## 0.1.0

Initial developer preview:

- policy discovery and JSON Schema
- mandate graph validation and `/.well-known/agent-mandates.json` schema
- enterprise control reports, access risk scoring, evidence digests, and audit exports
- immutable evidence bundle manifests and create-only storage abstraction
- OPA/Rego and Cedar-style policy-as-code export
- Algorand x402 TestNet readiness and live-gated facilitator check
- verifiable agent identity helpers and optional signed-header enforcement
- TypeScript agent preflight client
- Hono middleware
- MCP tool-boundary guard
- JSONL hash-chained receipts
- hash-chained access event trails that can be bound to receipts
- optional Ed25519 receipt signature helpers
- Algorand x402 TestNet adapter boundary
- CLI with init, doctor, policy, check, fetch, and receipt commands
- policy templates, policy explanations, receipt inspection, and signed receipt CLI
- example Hono site, agent client, publisher policy, API metering, and trust-passport publisher
- conformance checks for policy, decisions, headers, receipts, mandates, events, and Algorand x402 fixtures
- CI, secret scan, security docs, and maintainer checklist
