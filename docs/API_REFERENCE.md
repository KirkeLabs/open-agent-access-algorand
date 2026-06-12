# API Reference

## `@open-agent-access/core`

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

## `@open-agent-access/mandates`

- `validateMandateDocument(input)`: validates `/.well-known/agent-mandates.json`.
- `evaluateMandate(document, input)`: fails closed unless delegated authority
  matches agent identity, principal, purpose, use, method, resource, tool,
  consequence class, budget, and expiry.
- `mandateHash(mandate)`: stable hash for receipt and event binding.
- `buildMandateReceiptContext(result)`: compact mandate evidence for receipts.

## `@open-agent-access/mcp`

- `createAgentAccessMcpToolGuard(options)`: creates structural guards for MCP
  tool handlers.
- `authorizeMcpToolInvocation(options, invocation)`: returns policy and mandate
  authorization metadata without binding to a specific MCP SDK.
- `McpToolAuthorizationError`: thrown by wrapped handlers when policy or mandate
  checks fail.

## `@open-agent-access/hono`

- `agentAccessMiddleware(options)`: Hono middleware for policy enforcement,
  deterministic headers, local receipts, replay checks, and paid-route locks.
- `createMemoryReplayStore(options)`: default replay store for local or single
  process deployments. Production deployments should inject a shared store.

## `@open-agent-access/payments-algorand-x402`

- `createAlgorandX402ClientPaymentAdapter(config)`.
- `createAlgorandX402ServerPaymentAdapter(config)`.
- `wrapFetchWithAlgorandX402Payment(fetch, config)`.
- `buildAlgorandX402Accepts(config)`.
- `parseAlgorandX402SettlementHeaders(headers)`.
- `validateAlgorandX402Config(config)`.

## `@open-agent-access/cli`

```sh
oaa doctor
oaa conformance run
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

## `@open-agent-access/storage-redis`

- `createRedisReplayStore(client, options)`: replay-store adapter for Redis-like
  clients.

## `@open-agent-access/storage-postgres`

- `createPostgresReplayStore(client, options)`: replay-store adapter for
  Postgres clients with a `query(sql, params)` method.
- `createPostgresReplayTableSql(tableName?)`: migration SQL for the replay table.

## `@open-agent-access/express`

- `agentAccessExpressMiddleware(options)`: Express-compatible middleware using
  structural request/response types.

## `@open-agent-access/fastify`

- `createAgentAccessFastifyHook(options)`: Fastify-compatible pre-handler hook.

## `@open-agent-access/cloudflare`

- `withAgentAccessCloudflare(options, handler)`: Worker fetch wrapper for inline
  policy enforcement and injected receipt sinks.

## `@open-agent-access/conformance`

- `runConformanceSuite()`: protocol conformance checks for policy validation,
  path matching, decisions, headers, receipts, mandates, event trails, and
  Algorand x402 fixtures.
