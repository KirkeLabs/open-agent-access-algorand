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

## `@kirkelabs/open-agent-access-guard`

Human approval guardrails for agent-controlled repositories, deployments, and
production-facing actions.

- `classifyGuardAction(action)`: maps an action string to `read`, `summarize`,
  `pull`, `write`, `push`, `deploy`, `publish`, `env_write`, `domain_write`,
  `payment_config_write`, `smart_contract_deploy`, or `emergency_override`.
- `actionRequiresApproval(action)`: returns whether the action is mutating or
  production-facing.
- `getRepoSnapshot(repoPath)`: captures repo root, repo identity, branch, HEAD,
  remote, and dirty state.
- `generateDiffPacket({ repoPath, action })`: creates a review packet with
  changed files, diff hash, high-risk indicators, risk level, and recommended
  checks.
- `renderDiffPacketMarkdown(packet)`: renders a human-reviewable packet.
- `createApprovalToken({ repoPath, action, note, ttlMinutes, actor })`: creates
  a one-time token bound to action, repo, branch, HEAD, and diff hash.
- `guardAction({ repoPath, action, approvalToken, actor })`: returns a stable
  JSON decision for automation and consumes valid tokens once.
- `verifyApprovalLedger(path)`: verifies the append-only approval hash chain.
- `setFreezeState()` and `getGuardStatus()`: control and inspect freeze mode.
- `installGitPrePushHook({ repoPath })`: installs a local pre-push guard.
- `createGitHubRulesetTemplate(options)`: emits a GitHub ruleset JSON template.
- `reconcileVercelDeploymentApproval(options)`: reports whether a production
  deployment commit has a matching OAA deploy approval.

CLI:

```sh
oaa diff-packet --repo-path . --action git.push --output oaa-review.md
oaa approve git.push --repo-path . --note "Human reviewed the bounded diff packet" --token-file .oaa/approval-token
oaa guard git.push --repo-path . --approval-token "$OAA_APPROVAL_TOKEN" --json
oaa freeze on --repo-path . --reason "Incident review"
oaa approvals verify --ledger .oaa/approval-ledger.jsonl --json
oaa github ruleset-template --branch main --checks CI,CodeQL --signed-commits
oaa vercel reconcile --repo-path . --production-commit <sha> --json
```

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

## `@kirkelabs/open-agent-access-creative-rights`

- `validateCreativeAssetPassport(passport)`: validates a creative asset passport
  and throws on hard errors.
- `safeValidateCreativeAssetPassport(passport)`: returns validation errors and
  warnings without throwing.
- `hashCreativeAssetPassport(passport)`: stable hash for provenance and receipt
  binding.
- `createCreativeAssetAccessPolicy(passport, options)`: emits OAA policy rules
  for license-specific asset paths.
- `createCreativeReceiptEvidence(passport)`: creates receipt evidence for
  rights claims, provenance references, registry references, and legal
  boundaries.
- `attachCreativeEvidenceToReceipt(receipt, passport)`: attaches creative
  evidence to an OAA receipt event.

## `@kirkelabs/open-agent-access-vc`

- `createAgentPassportCredential(input)`: creates a W3C VC-shaped OAA agent
  passport credential.
- `safeValidateAgentPassportCredential(credential)`: validates credential shape,
  validity window, and OAA subject binding.
- `validateAgentPassportCredential(credential)`: throws on invalid, expired, or
  not-yet-valid credentials.
- `agentIdentityFromCredential(credential)`: extracts OAA agent identity.
- `buildAgentAccessHeadersFromCredential(credential, input)`: builds AA headers
  from a portable agent passport.
- `hashAgentPassportCredential(credential)`: stable credential hash for receipt
  binding.

## `@kirkelabs/open-agent-access-odrl`

- `exportAgentAccessPolicyToOdrl(policy)`: exports OAA policy rules as
  ODRL-shaped permissions, prohibitions, and duties.
- `importOdrlPolicyToAgentAccessPolicy(odrl, options)`: imports a small
  ODRL-shaped policy into OAA rules.
- `mapOaaUseToOdrlAction(use)` and `mapOdrlActionToOaaUse(action)`: action/use
  mapping helpers.

## `@kirkelabs/open-agent-access-openapi`

- `createOpenApiAgentAccessExtension(input)`: creates an
  `x-open-agent-access` operation extension.
- `applyAgentAccessToOpenApiOperation(document, input)`: adds OAA metadata to an
  OpenAPI operation.
- `extractAgentAccessPolicyFromOpenApi(document, options)`: creates an OAA
  policy from all `x-open-agent-access` extensions.
- `openApiPathToAgentAccessPath(path)`: converts OpenAPI path templates to OAA
  path patterns.
- `addAgentAccessSecurityScheme(document)`: adds an AA header security scheme.

## `@kirkelabs/open-agent-access-otel`

- `receiptToOtelSpan(receipt, options)`: exports a receipt as an
  OpenTelemetry-shaped span.
- `accessEventToOtelLog(event)`: exports an access event as an
  OpenTelemetry-shaped log record.
- `decisionToOtelSpan(input)`: exports a policy decision as an internal span.
- `OAA_OTEL_ATTRIBUTES`: stable semantic attribute names for OAA telemetry.

## `@kirkelabs/open-agent-access-agent-card`

- `createAgentAccessManifestBinding(input)`: creates an OAA manifest binding.
- `attachAgentAccessToAgentCard(card, binding)`: adds OAA policy metadata to an
  agent card-like object.
- `extractAgentAccessFromAgentCard(card)`: reads OAA metadata from an agent card.
- `attachAgentAccessToMcpTool(tool, binding)`: adds OAA rule binding metadata to
  an MCP tool manifest-like object, including Codex-compatible `permissions`
  hints (`Read`, `Write`, `Interactive`).
- `createToolPolicyBindingsPolicy(input)`: creates an OAA policy from tool
  bindings.

## `@kirkelabs/open-agent-access-industry-profiles`

- `createPublishingDataProfilePolicy(options)`
- `createSaasApiProfilePolicy(options)`
- `createSupplyChainProductProfilePolicy(options)`
- `createHealthcareConsentProfilePolicy(options)`
- `createEnergyInfrastructureProfilePolicy(options)`

## `@kirkelabs/open-agent-access-policy-signing`

- `createPolicySigningKeyPair()`: creates local Ed25519 policy signing keys.
- `signAgentAccessPolicy(policy, input)`: signs an OAA policy hash.
- `verifySignedAgentAccessPolicy(policy, trustedKeys, options)`: verifies a
  policy signature against trusted keys and validity windows.
- `createPolicyTrustRecord(input)`: creates a machine-readable trust record for
  a policy signing key.

## `@kirkelabs/open-agent-access-transparency`

- `createTransparencyLog(entries)`: creates a Merkle transparency log.
- `receiptToTransparencyEntry(receipt)`: converts an OAA receipt to a log entry.
- `createInclusionProof(log, index)`: creates a Merkle inclusion proof.
- `verifyInclusionProof(proof)`: verifies an inclusion proof.
- `merkleRoot(hashes)`: computes a deterministic Merkle root.

## `@kirkelabs/open-agent-access-replay`

- `createMemoryReplayStore(options)`: local replay store for tests and demos.
- `buildResourceBindingHash(input)`: binds method, URL, policy hash, rule ID,
  trace ID, and idempotency key.
- `buildReplayKey(input)`: binds resource and payment proof into a replay key.
- `checkAndRememberReplay(store, key, ttlMs)`: atomic-ish local replay helper.
- `requireIdempotencyKey(input)`: validates idempotency requirements for paid or
  mutating actions.

## `@kirkelabs/open-agent-access-security-profiles`

- `evaluateSecurityProfile(policy, profile)`: checks `local-dev`,
  `public-demo`, `production`, `enterprise`, or `regulated` hardening posture.

## `@kirkelabs/open-agent-access-algorand-anchor`

- `createPolicyAnchorPayload(policy, network, metadata)`.
- `createReceiptAnchorPayload(receipt, network, metadata)`.
- `createTransparencyRootAnchorPayload(log, network, metadata)`.
- `createAlgorandAnchorRecord(payload, settlement)`.
- `buildAlgorandAnchorNote(payload)`.
- `verifyAlgorandAnchorRecord(record, expected)`.

## `@kirkelabs/open-agent-access-hono`

- `agentAccessMiddleware(options)`: Hono middleware for policy enforcement,
  deterministic headers, local receipts, replay checks, and paid-route locks.
- `createMemoryReplayStore(options)`: default replay store for local or single
  process deployments. Production deployments should inject a shared store.

## `@kirkelabs/open-agent-access-x402-bazaar`

- `createBazaarDiscoveryFromOaaRule(rule, options)`: converts an OAA policy rule
  into Bazaar-style discovery metadata with an embedded `openAgentAccess`
  policy reference.
- `buildOaaX402BazaarMetadata(options)`: builds the policy reference containing
  policy URL, policy hash, rule ID, decision, purposes, uses, receipt requirement,
  payment requirement, and resource binding hash.
- `attachOaaPolicyRefToBazaarExtension(discovery, policyRef)`: adds OAA policy
  metadata to existing Bazaar discovery metadata.
- `createBazaarResourceRoute(options)`: creates a route shape with `accepts` and
  Bazaar/OAA extensions side by side.
- `extractOaaPolicyRefFromBazaarExtension(input)`: extracts an OAA policy ref
  from a Bazaar route/extension object.
- `createOaaRuleFromBazaarDiscovery(options)`: reconstructs an OAA rule from
  Bazaar discovery metadata when importing external catalogues.

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

## `@kirkelabs/open-agent-access-vercel`

- `createAgentAccessVercelMiddleware(options)`: Vercel/Next.js middleware for
  protected static or dynamic routes, policy serving, human browser fallback,
  and agent decision headers.
- `createAgentAccessStaticPolicyCopy(policy)`: validates and serializes a
  policy for copying to `public/.well-known/agent-access.json`.

## `@kirkelabs/open-agent-access-conformance`

- `runConformanceSuite()`: protocol conformance checks for policy validation,
  path matching, decisions, headers, receipts, mandates, event trails, and
  Algorand x402 fixtures.
