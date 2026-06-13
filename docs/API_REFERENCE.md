# API Reference

## `open-agent-access`

One-command CLI front door for external repos.

```sh
npx @kirkelabs/open-agent-access init
npx @kirkelabs/open-agent-access init --template hono --protected /premium/report
npx --package @kirkelabs/open-agent-access agent-passport init --template static-site --protected /essays
```

This package delegates to `@kirkelabs/open-agent-access-cli`. Use it for onboarding and
human-friendly commands. Use scoped packages for runtime imports.

## `@kirkelabs/open-agent-access-core`

- `createAgentAccessClient(options)`: discovers policy, decides access, attaches
  agent headers, optionally pays, and writes receipts.
- `validateAgentAccessPolicy(input)`: validates v0.1 policy objects.
- `discoverPolicy(url)`: resolves `/.well-known/agent-access.json`.
- `decideAccess(policy, request)`: returns allow, deny, charge, throttle, review,
  redirect, or human-only decisions.
- `buildAgentAccessHeaders(input)` and `parseAgentAccessHeaders(headers)`.
- `buildSiteDecisionHeaders(input)` and `parseSiteDecisionHeaders(headers)`.
- `appendReceipt(path, receipt)`, `verifyReceiptChain(path)`,
  `readReceiptLedger(path)`, `exportDigest(path)`.
- `createReceiptSigningKeyPair()`, `signReceipt()`, and
  `verifyReceiptSignature()` for optional Ed25519 receipt signatures.
- `createAccessEvent()`, `appendAccessEvent()`, `verifyAccessEventTrail()`,
  `hashAccessEvents()`, and `attachEventTrailToReceipt()` for reconstructable
  event trails.

## `@kirkelabs/open-agent-access-mandates`

- `validateMandateDocument(input)`: validates `/.well-known/agent-mandates.json`.
- `evaluateMandate(document, input)`: fails closed unless delegated authority
  matches agent identity, principal, purpose, use, method, resource, tool,
  consequence class, budget, and expiry.
- `mandateHash(mandate)`: stable hash for receipt and event binding.
- `buildMandateReceiptContext(result)`: compact mandate evidence for receipts.

## `@kirkelabs/open-agent-access-identity`

- `createAgentIdentityKeyPair()`: creates local Ed25519 signing keys.
- `signAgentAccessHeaders(headers, options)`: signs agent access headers against
  method and URL.
- `verifyAgentAccessHeaders(headers, options)`: verifies signed identity against
  trusted public keys.
- `buildAgentSignatureInput(headers, context)`: returns the canonical signature
  payload.
- `parseTrustedAgentKeys(input)`: validates trusted-key lists.

## `@kirkelabs/open-agent-access-mcp`

- `createAgentAccessMcpToolGuard(options)`: creates structural guards for MCP
  tool handlers.
- `authorizeMcpToolInvocation(options, invocation)`: returns policy and mandate
  authorization metadata without binding to a specific MCP SDK.
- `McpToolAuthorizationError`: thrown by wrapped handlers when policy or mandate
  checks fail.

## `@kirkelabs/open-agent-access-enterprise`

- `createEnterpriseControlReport(input)`: scores policy, mandate, and receipt
  posture against enterprise controls.
- `assessEnterpriseAccessRisk(input)`: classifies an access attempt as low,
  medium, high, or critical risk.
- `receiptToOpenTelemetrySpan(receipt, options)`: exports receipt evidence as an
  OpenTelemetry-style span object.
- `receiptToCefEvent(receipt, options)`: exports receipt evidence as a CEF/SIEM
  event line.
- `redactEnterpriseAuditRecord(record, options)`: redacts PII-sensitive fields
  while keeping stable correlation hashes.
- `createEvidenceBundleDigest(input)`: creates a compact digest over policy,
  mandates, receipts, and events.

## `@kirkelabs/open-agent-access-evidence`

- `createEvidenceBundle(input)`: creates an immutable evidence manifest over
  policy, mandates, receipts, and events.
- `verifyEvidenceBundle(bundle)`: verifies manifest counts, head hash, and bundle
  hash.
- `putImmutableEvidenceBundle(store, bundle, options)`: writes a create-only
  manifest object to an immutable store abstraction.
- `createMemoryImmutableEvidenceStore()`: test fixture for create-only behavior.

## `@kirkelabs/open-agent-access-policy-as-code`

- `exportOpaBundle(policy)`: exports OAA policy as OPA data, Rego, and an input
  example.
- `exportCedarBundle(policy)`: exports OAA policy as a Cedar-style schema and
  policy statements.

## `@kirkelabs/open-agent-access-compliance`

- `listComplianceFrameworks()`: supported compliance mapping keys.
- `getComplianceMapping(framework)`: evidence mapping for one framework.
- `getAllComplianceMappings()`: evidence mappings for every supported framework.

## `@kirkelabs/open-agent-access-incident`

- `createAgentStopSignal(input)`: creates a machine-readable emergency stop
  signal.
- `validateAgentStopSignal(input)`: validates an `agent-stop` document.
- `evaluateStopSignal(signal, input)`: checks whether a request is stopped by
  signal scope, expiry, and active state.

## `@kirkelabs/open-agent-access-hono`

- `agentAccessMiddleware(options)`: Hono middleware for policy enforcement,
  deterministic headers, local receipts, replay checks, and paid-route locks.
- `createMemoryReplayStore(options)`: default replay store for local or single
  process deployments. Production deployments should inject a shared store.

## `@kirkelabs/open-agent-access-payments-algorand-x402`

- `createAlgorandX402ClientPaymentAdapter(config)`.
- `createAlgorandX402ServerPaymentAdapter(config)`.
- `wrapFetchWithAlgorandX402Payment(fetch, config)`.
- `buildAlgorandX402Accepts(config)`.
- `parseAlgorandX402SettlementHeaders(headers)`.
- `validateAlgorandX402Config(config)`.

## `@kirkelabs/open-agent-access-cli`

```sh
oaa doctor
oaa conformance run
oaa enterprise report --policy agent-access.json --mandates agent-mandates.json --ledger .oaa/receipts.jsonl
oaa enterprise export-audit .oaa/receipts.jsonl --format otel --redact
oaa evidence bundle --policy agent-access.json --mandates agent-mandates.json --ledger .oaa/receipts.jsonl --output oaa-evidence-bundle.json
oaa evidence verify oaa-evidence-bundle.json
oaa identity keygen
oaa policy export agent-access.json --format opa --output /tmp/oaa-opa
oaa x402 testnet-check --json
oaa compliance map --framework all --json
oaa incident stop --output agent-stop.json --reason incident_response --paths '/premium/**'
oaa incident check agent-stop.json --path /premium/report --purpose research
oaa identity sign-request --private-key .oaa/agent-private.pem --key-id did:web:agent.example#key-1 --agent-id did:web:agent.example --url URL --purpose research --use read
oaa policy init --template publisher --origin https://example.com
oaa policy validate ./agent-access.json
oaa policy lint ./agent-access.json
oaa policy explain ./agent-access.json https://example.com/path --purpose research --use read
oaa check URL --purpose research --use read
oaa fetch URL --purpose research --use read --budget USD:0.05
oaa receipts verify .oaa/receipts.jsonl
oaa receipts inspect .oaa/receipts.jsonl --trace-id TRACE
oaa receipts reconcile .oaa/receipts.jsonl .oaa/site-receipts.jsonl
oaa receipts keygen
oaa receipts sign .oaa/receipts.jsonl .oaa/signed-receipts.jsonl --private-key .oaa/receipt-private.pem
oaa receipts verify-signatures .oaa/signed-receipts.jsonl --public-key .oaa/receipt-public.pem
```

## `@kirkelabs/open-agent-access-storage-redis`

- `createRedisReplayStore(client, options)`: replay-store adapter for Redis-like
  clients.

## `@kirkelabs/open-agent-access-storage-postgres`

- `createPostgresReplayStore(client, options)`: replay-store adapter for
  Postgres clients with a `query(sql, params)` method.
- `createPostgresReplayTableSql(tableName?)`: migration SQL for the replay table.

## `@kirkelabs/open-agent-access-express`

- `agentAccessExpressMiddleware(options)`: Express-compatible middleware using
  structural request/response types.

## `@kirkelabs/open-agent-access-fastify`

- `createAgentAccessFastifyHook(options)`: Fastify-compatible pre-handler hook.

## `@kirkelabs/open-agent-access-cloudflare`

- `withAgentAccessCloudflare(options, handler)`: Worker fetch wrapper for inline
  policy enforcement and injected receipt sinks.

## `@kirkelabs/open-agent-access-conformance`

- `runConformanceSuite()`: protocol conformance checks for policy validation,
  path matching, decisions, headers, receipts, mandates, event trails, and
  Algorand x402 fixtures.
