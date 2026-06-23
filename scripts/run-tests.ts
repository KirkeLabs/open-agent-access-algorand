import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import {
  appendReceipt,
  appendAccessEvent,
  attachEventTrailToReceipt,
  budgetAllowsPrice,
  buildAgentAccessHeaders,
  buildSiteDecisionHeaders,
  createAccessEvent,
  createReceiptSigningKeyPair,
  createPolicyTemplate,
  decideAccess,
  exportDigest,
  explainPolicyDecision,
  hashCanonicalJson,
  lintAgentAccessPolicy,
  parseAgentAccessHeaders,
  parseSiteDecisionHeaders,
  pathMatches,
  readReceiptLedger,
  reconcileReceiptLedgers,
  signReceipt,
  validateAgentAccessPolicy,
  verifyAccessEventTrail,
  verifyReceiptChain,
  verifyReceiptSignature,
  type AgentAccessPolicy
} from "../packages/core/src/index.js";
import {
  buildAlgorandX402Accepts,
  createAlgorandX402PaymentRequiredFixture,
  createAlgorandX402SettlementFixture,
  createMalformedAlgorandX402SettlementFixture,
  parseAlgorandX402SettlementHeaders,
  runAlgorandX402TestnetCheck,
  validateAlgorandX402Config,
  wrapFetchWithAlgorandX402Payment
} from "../packages/payments-algorand-x402/src/index.js";
import { agentAccessMiddleware, type ReplayStore } from "../packages/hono/src/index.js";
import { createRedisReplayStore } from "../packages/storage-redis/src/index.js";
import { createPostgresReplayStore, createPostgresReplayTableSql } from "../packages/storage-postgres/src/index.js";
import { agentAccessExpressMiddleware } from "../packages/express/src/index.js";
import { createAgentAccessFastifyHook } from "../packages/fastify/src/index.js";
import { withAgentAccessCloudflare } from "../packages/cloudflare/src/index.js";
import { createAgentAccessVercelMiddleware } from "../packages/vercel/src/index.js";
import { runConformanceSuite } from "../packages/conformance/src/index.js";
import { getAllComplianceMappings, getComplianceMapping, listComplianceFrameworks } from "../packages/compliance/src/index.js";
import { createAgentIdentityKeyPair, signAgentAccessHeaders, verifyAgentAccessHeaders } from "../packages/identity/src/index.js";
import { createAgentStopSignal, evaluateStopSignal, validateAgentStopSignal } from "../packages/incident/src/index.js";
import { evaluateMandate, validateMandateDocument, type MandateDocument } from "../packages/mandates/src/index.js";
import { createAgentAccessMcpToolGuard, McpToolAuthorizationError } from "../packages/mcp/src/index.js";
import {
  assessEnterpriseAccessRisk,
  createEnterpriseControlReport,
  createEvidenceBundleDigest,
  receiptToCefEvent,
  receiptToOpenTelemetrySpan
} from "../packages/enterprise/src/index.js";
import {
  createEvidenceBundle,
  createMemoryImmutableEvidenceStore,
  putImmutableEvidenceBundle,
  verifyEvidenceBundle
} from "../packages/evidence/src/index.js";
import { exportCedarBundle, exportOpaBundle } from "../packages/policy-as-code/src/index.js";
import {
  attachCreativeEvidenceToReceipt,
  createCreativeAssetAccessPolicy,
  createCreativeReceiptEvidence,
  hashCreativeAssetPassport,
  safeValidateCreativeAssetPassport,
  type CreativeAssetPassport
} from "../packages/creative-rights/src/index.js";
import {
  agentIdentityFromCredential,
  buildAgentAccessHeadersFromCredential,
  createAgentPassportCredential,
  hashAgentPassportCredential,
  safeValidateAgentPassportCredential
} from "../packages/vc/src/index.js";
import {
  exportAgentAccessPolicyToOdrl,
  importOdrlPolicyToAgentAccessPolicy
} from "../packages/odrl/src/index.js";
import {
  addAgentAccessSecurityScheme,
  applyAgentAccessToOpenApiOperation,
  extractAgentAccessPolicyFromOpenApi,
  openApiPathToAgentAccessPath,
  type OpenApiDocument
} from "../packages/openapi/src/index.js";
import {
  accessEventToOtelLog,
  decisionToOtelSpan,
  receiptToOtelSpan
} from "../packages/otel/src/index.js";
import {
  attachAgentAccessToAgentCard,
  attachAgentAccessToMcpTool,
  createAgentAccessManifestBinding,
  createToolPolicyBindingsPolicy,
  extractAgentAccessFromAgentCard
} from "../packages/agent-card/src/index.js";
import {
  createEnergyInfrastructureProfilePolicy,
  createHealthcareConsentProfilePolicy,
  createPublishingDataProfilePolicy,
  createSaasApiProfilePolicy,
  createSupplyChainProductProfilePolicy
} from "../packages/industry-profiles/src/index.js";
import {
  createPolicySigningKeyPair,
  createPolicyTrustRecord,
  signAgentAccessPolicy,
  verifySignedAgentAccessPolicy
} from "../packages/policy-signing/src/index.js";
import {
  createInclusionProof,
  createTransparencyLog,
  receiptToTransparencyEntry,
  verifyInclusionProof
} from "../packages/transparency/src/index.js";
import {
  buildReplayKey,
  buildResourceBindingHash,
  checkAndRememberReplay,
  createMemoryReplayStore as createSharedMemoryReplayStore,
  requireIdempotencyKey
} from "../packages/replay/src/index.js";
import { evaluateSecurityProfile } from "../packages/security-profiles/src/index.js";
import {
  buildAlgorandAnchorNote,
  createAlgorandAnchorRecord,
  createPolicyAnchorPayload,
  createReceiptAnchorPayload,
  createTransparencyRootAnchorPayload,
  verifyAlgorandAnchorRecord
} from "../packages/algorand-anchor/src/index.js";
import {
  createBazaarDiscoveryFromOaaRule,
  createBazaarResourceRoute,
  createOaaRuleFromBazaarDiscovery,
  extractOaaPolicyRefFromBazaarExtension
} from "../packages/x402-bazaar/src/index.js";
import {
  createApprovalToken,
  createGitHubRulesetTemplate,
  generateDiffPacket,
  getGuardStatus,
  guardAction,
  installGitPrePushHook,
  reconcileVercelDeploymentApproval,
  setFreezeState,
  verifyApprovalLedger
} from "../packages/guard/src/index.js";

type Test = { name: string; fn: () => Promise<void> | void };
const tests: Test[] = [];

function test(name: string, fn: Test["fn"]) {
  tests.push({ name, fn });
}

const policy: AgentAccessPolicy = {
  version: "0.1",
  protocol: "open-agent-access",
  site: { name: "Example", origin: "https://example.com" },
  defaults: { decision: "review", requireAgentIdentity: true, requirePurpose: true },
  rules: [
    {
      id: "docs",
      match: { methods: ["GET"], paths: ["/docs/**"] },
      decision: "allow",
      purposes: ["research"],
      uses: ["read"],
      deniedUses: ["ai-train"],
      rateLimit: { requests: 2, window: "1m" }
    },
    {
      id: "premium",
      match: { methods: ["GET"], paths: ["/premium/**"] },
      decision: "charge",
      purposes: ["research"],
      uses: ["ai-input"],
      price: { amount: "0.005", currency: "USD", unit: "request" }
    }
  ]
};

const mandateDocument: MandateDocument = {
  version: "0.1",
  protocol: "open-agent-access",
  kind: "agent-mandates",
  issuer: { name: "Example", origin: "https://example.com" },
  mandates: [
    {
      id: "research-public",
      subject: {
        agentId: "did:web:agent.example",
        principal: "user:steve@example.com",
        operator: "Example Labs"
      },
      delegator: { id: "user:steve@example.com", name: "Steve" },
      scope: {
        purposes: ["research"],
        uses: ["read", "ai-input"],
        methods: ["GET", "POST"],
        resources: ["https://example.com/docs/**", "https://example.com/mcp/tools/**"],
        tools: ["fetch", "docs.search"],
        consequenceClasses: ["public-read"],
        maxBudget: { amount: "0.05", currency: "USD" }
      },
      expiresAt: "2099-01-01T00:00:00.000Z",
      approval: {
        requiredForConsequences: ["publish"],
        requiredAboveBudget: { amount: "0.05", currency: "USD" },
        escalationUrl: "https://example.com/review"
      },
      evidence: {
        events: ["mandate_evaluated", "policy_decision"],
        receiptRequired: true,
        policyHashRequired: true
      }
    }
  ]
};

const creativePassport: CreativeAssetPassport = {
  version: "0.1",
  protocol: "open-agent-access",
  kind: "creative-asset-passport",
  asset: {
    id: "manchester-loop-001",
    title: "Manchester Perc Loop 001",
    type: "loop",
    hash: "sha256:example-placeholder",
    hashAlgorithm: "sha-256"
  },
  rights: {
    claimant: { name: "Example Manchester Producer", wallet: "ALGORAND_ADDRESS_PLACEHOLDER" },
    claims: ["sound-recording", "sample-pack"],
    authorshipBasis: "original",
    collaborators: [{ name: "Example Manchester Producer", role: "producer", share: 100 }]
  },
  policy: {
    defaultDecision: "review",
    deniedUses: ["ai-training"],
    aiTraining: { allowed: false },
    licenseOptions: [
      {
        id: "community-demo",
        decision: "allow",
        purposes: ["creative-licensing"],
        uses: ["demo", "non-commercial-sample"],
        attributionRequired: true
      },
      {
        id: "commercial-sample",
        decision: "charge",
        purposes: ["creative-licensing"],
        uses: ["commercial-sample"],
        price: { amount: "25", currency: "GBP", unit: "license" },
        attributionRequired: true
      },
      {
        id: "exclusive-sync",
        decision: "review",
        purposes: ["sync"],
        uses: ["exclusive-license"],
        reviewUrl: "https://example.com/review"
      }
    ]
  },
  provenance: { assetHash: "sha256:example-placeholder", assetHashAlgorithm: "sha-256" },
  registry: {
    algorand: { network: "testnet" },
    rsl: { licenseUrl: "https://example.com/licenses/manchester-loop-001" }
  },
  legalNotice: "This passport records a rights claim and license terms. It is not a copyright registration."
};

test("policy schema validation", () => {
  assert.equal(validateAgentAccessPolicy(policy).rules.length, 2);
  for (const template of ["publisher", "paid-api", "mcp-tool", "docs-site", "research-friendly"] as const) {
    const generated = validateAgentAccessPolicy(createPolicyTemplate(template, "https://template.example"));
    assert.ok(generated.rules.length >= 1);
  }
});

test("creative passport emits deterministic OAA policy and receipt evidence without copyright overclaims", () => {
  const validation = safeValidateCreativeAssetPassport(creativePassport);
  assert.equal(validation.valid, true);
  assert.equal(validation.errors.length, 0);

  const passportHash = hashCreativeAssetPassport(creativePassport);
  assert.equal(passportHash.length, 64);

  const creativePolicy = createCreativeAssetAccessPolicy(creativePassport, {
    origin: "https://creative.example"
  });
  assert.equal(validateAgentAccessPolicy(creativePolicy).rules.length, 3);

  const paid = decideAccess(creativePolicy, {
    url: "https://creative.example/creative-assets/manchester-loop-001/licenses/commercial-sample",
    method: "GET",
    purpose: "creative-licensing",
    use: "commercial-sample",
    agent: { id: "did:web:buyer.example#agent" }
  });
  assert.equal(paid.decision, "charge");
  assert.equal(paid.rule?.price?.amount, "25");

  const aiTraining = decideAccess(creativePolicy, {
    url: "https://creative.example/creative-assets/manchester-loop-001/licenses/commercial-sample",
    method: "GET",
    purpose: "ai-training",
    use: "ai-training",
    agent: { id: "did:web:buyer.example#agent" }
  });
  assert.equal(aiTraining.decision, "deny");

  const evidence = createCreativeReceiptEvidence(creativePassport);
  assert.equal(evidence.legalBoundary.createsCopyright, false);
  assert.equal(evidence.legalBoundary.provesFinalOwnership, false);
  assert.equal(evidence.registry?.algorand?.network, "testnet");

  const receiptWithEvidence = attachCreativeEvidenceToReceipt({
    receiptVersion: "0.1",
    receiptType: "agent_access",
    role: "site",
    traceId: "trace-creative",
    receiptId: "receipt-creative",
    timestamp: "2026-06-16T00:00:00.000Z",
    method: "GET",
    url: "https://creative.example/creative-assets/manchester-loop-001/licenses/commercial-sample",
    origin: "https://creative.example",
    policy: {
      ruleId: "manchester-loop-001-commercial-sample",
      policyHash: hashCanonicalJson(creativePolicy),
      decision: "charge"
    },
    payment: { required: true, price: { amount: "25", currency: "GBP", unit: "license" } }
  }, creativePassport);
  assert.equal(receiptWithEvidence.events?.length, 1);
  const attachedEvidence = receiptWithEvidence.events?.[0]?.evidence as ReturnType<typeof createCreativeReceiptEvidence> | undefined;
  assert.equal(attachedEvidence?.creativePassport.assetId, "manchester-loop-001");
});

test("interoperability adapters bridge VC, ODRL, and OpenAPI into OAA decisions", () => {
  const credential = createAgentPassportCredential({
    issuer: "did:web:kirkelabs.com",
    agent: {
      id: "did:web:agent.example#research-agent",
      name: "Research Agent",
      operator: "Example Labs",
      contact: "mailto:agents@example.com"
    },
    purposes: ["research"],
    uses: ["read", "ai-input"],
    validUntil: "2099-01-01T00:00:00.000Z"
  });
  const credentialValidation = safeValidateAgentPassportCredential(credential, {
    now: new Date("2026-06-16T00:00:00.000Z")
  });
  assert.equal(credentialValidation.valid, true);
  assert.equal(agentIdentityFromCredential(credential).id, "did:web:agent.example#research-agent");
  assert.equal(hashAgentPassportCredential(credential).length, 64);
  const vcHeaders = buildAgentAccessHeadersFromCredential(credential, {
    purpose: "research",
    use: "read",
    traceId: "trace-vc"
  });
  const parsedVcHeaders = parseAgentAccessHeaders(vcHeaders);
  assert.ok(parsedVcHeaders);
  assert.equal(parsedVcHeaders.agent.id, "did:web:agent.example#research-agent");

  const odrl = exportAgentAccessPolicyToOdrl(policy);
  assert.ok(odrl.permission?.some((entry) => entry.uid === "premium"));
  assert.ok(odrl.prohibition?.some((entry) => entry.uid?.includes("denied")));
  const imported = validateAgentAccessPolicy(importOdrlPolicyToAgentAccessPolicy(odrl, {
    siteName: "Imported",
    origin: "https://example.com"
  }));
  const importedDecision = decideAccess(imported, {
    url: "https://example.com/premium/report",
    method: "GET",
    purpose: "research",
    use: "ai-input",
    agent: { id: "did:web:agent.example#research-agent" }
  });
  assert.equal(importedDecision.decision, "charge");

  const openapi: OpenApiDocument = {
    openapi: "3.1.0",
    info: { title: "Agent API", version: "0.1.0" },
    servers: [{ url: "https://api.example.com" }],
    paths: {
      "/premium/{reportId}": {
        get: {
          operationId: "getPremiumReport"
        }
      }
    }
  };
  const documented = addAgentAccessSecurityScheme(applyAgentAccessToOpenApiOperation(openapi, {
    path: "/premium/{reportId}",
    method: "get",
    extension: {
      decision: "charge",
      purposes: ["research"],
      uses: ["ai-input"],
      price: { amount: "0.005", currency: "USD", unit: "request" },
      receipt: { required: true }
    }
  }));
  assert.equal(openApiPathToAgentAccessPath("/premium/{reportId}"), "/premium/*");
  assert.ok((documented.components?.securitySchemes as Record<string, unknown> | undefined)?.OpenAgentAccess);
  const openApiPolicy = validateAgentAccessPolicy(extractAgentAccessPolicyFromOpenApi(documented));
  const openApiDecision = decideAccess(openApiPolicy, {
    url: "https://api.example.com/premium/weekly-report",
    method: "GET",
    purpose: "research",
    use: "ai-input",
    agent: { id: "did:web:agent.example#research-agent" }
  });
  assert.equal(openApiDecision.decision, "charge");
  assert.equal(openApiDecision.rule?.id, "getPremiumReport");
});

test("observability, agent-card, and industry profile adapters produce enforceable outputs", () => {
  const receipt = {
    receiptVersion: "0.1",
    receiptType: "agent_access",
    role: "site",
    traceId: "trace-observe",
    receiptId: "receipt-observe",
    timestamp: "2026-06-16T00:00:00.000Z",
    method: "GET",
    url: "https://example.com/premium/report?token=secret",
    origin: "https://example.com",
    agent: { id: "did:web:agent.example#research-agent" },
    declared: { purpose: "research", use: "ai-input" },
    policy: { ruleId: "premium", policyHash: "policy-hash", decision: "charge" },
    payment: { required: true, settlement: "algorand", network: "testnet" },
    receiptHash: "receipt-hash"
  } as const;
  const span = receiptToOtelSpan(receipt, { redactUrl: true });
  assert.equal(span.name, "oaa.payment");
  assert.equal(span.attributes["oaa.payment.settlement"], "algorand");
  assert.equal(String(span.attributes["oaa.url"]).includes("token=secret"), false);

  const event = createAccessEvent({
    traceId: "trace-observe",
    type: "policy_decision",
    subject: { method: "GET", url: "https://example.com/premium/report" },
    policy: { ruleId: "premium", policyHash: "policy-hash", decision: "charge" }
  });
  const log = accessEventToOtelLog(event);
  assert.equal(log.body, "oaa.policy_decision");

  const decisionSpan = decisionToOtelSpan({
    traceId: "trace-observe",
    decision: decideAccess(policy, {
      url: "https://example.com/premium/report",
      method: "GET",
      purpose: "research",
      use: "ai-input",
      agent: { id: "did:web:agent.example#research-agent" }
    }),
    method: "GET",
    url: "https://example.com/premium/report",
    policyHash: hashCanonicalJson(policy),
    timestamp: "2026-06-16T00:00:00.000Z"
  });
  assert.equal(decisionSpan.attributes["oaa.policy.decision"], "charge");

  const binding = createAgentAccessManifestBinding({
    policyUrl: "https://agent.example/.well-known/agent-access.json",
    mandateUrl: "https://agent.example/.well-known/agent-mandates.json",
    receiptRequired: true,
    algorandX402Supported: true
  });
  const card = attachAgentAccessToAgentCard({ name: "Research Agent", url: "https://agent.example" }, binding);
  assert.equal(extractAgentAccessFromAgentCard(card)?.policyUrl, binding.policyUrl);

  const tool = attachAgentAccessToMcpTool({ name: "premium.search" }, {
    toolName: "premium.search",
    ruleId: "tool-premium-search",
    path: "/mcp/tools/premium.search",
    purposes: ["research"],
    uses: ["tool-call"],
    price: { amount: "0.01", currency: "USD", unit: "call" }
  });
  assert.equal(tool.annotations.openAgentAccess.ruleId, "tool-premium-search");
  const toolPolicy = validateAgentAccessPolicy(createToolPolicyBindingsPolicy({
    siteName: "MCP Server",
    origin: "https://mcp.example",
    bindings: [tool.annotations.openAgentAccess]
  }));
  const toolDecision = decideAccess(toolPolicy, {
    url: "https://mcp.example/mcp/tools/premium.search",
    method: "POST",
    purpose: "research",
    use: "tool-call",
    agent: { id: "did:web:agent.example#research-agent" }
  });
  assert.equal(toolDecision.decision, "charge");

  const publishing = createPublishingDataProfilePolicy({
    siteName: "Publisher",
    origin: "https://publisher.example",
    paid: { price: { amount: "0.005", currency: "USD", unit: "request" } }
  });
  assert.equal(decideAccess(publishing.policy, {
    url: "https://publisher.example/articles/story",
    method: "GET",
    purpose: "research",
    use: "summarize",
    agent: { id: "did:web:agent.example#research-agent" }
  }).decision, "allow");

  const saas = createSaasApiProfilePolicy({ siteName: "SaaS", origin: "https://api.example" });
  assert.equal(decideAccess(saas.policy, {
    url: "https://api.example/api/tasks",
    method: "POST",
    purpose: "workflow-automation",
    use: "write",
    agent: { id: "did:web:agent.example#research-agent" }
  }).decision, "review");

  const supplyChain = createSupplyChainProductProfilePolicy({ siteName: "Supply", origin: "https://supply.example" });
  assert.equal(decideAccess(supplyChain.policy, {
    url: "https://supply.example/products/123",
    method: "GET",
    purpose: "traceability",
    use: "verify",
    agent: { id: "did:web:agent.example#research-agent" }
  }).decision, "allow");

  const healthcare = createHealthcareConsentProfilePolicy({ siteName: "FHIR", origin: "https://health.example" });
  assert.equal(decideAccess(healthcare.policy, {
    url: "https://health.example/fhir/Patient/123",
    method: "GET",
    purpose: "care",
    use: "read",
    agent: { id: "did:web:agent.example#research-agent" }
  }).decision, "review");
  assert.ok(healthcare.cautions[0].includes("Not compliance-in-a-box"));

  const energy = createEnergyInfrastructureProfilePolicy({
    siteName: "Energy",
    origin: "https://energy.example",
    paid: { price: { amount: "0.002", currency: "USD", unit: "request" } }
  });
  assert.equal(decideAccess(energy.policy, {
    url: "https://energy.example/market-data/tariffs",
    method: "GET",
    purpose: "monitoring",
    use: "read",
    agent: { id: "did:web:agent.example#research-agent" }
  }).decision, "charge");
});

test("x402 Bazaar interop binds paid resource discovery to OAA policy references", () => {
  const premiumRule = policy.rules.find((rule) => rule.id === "premium");
  assert.ok(premiumRule);
  const policyHash = hashCanonicalJson(policy);
  const discovery = createBazaarDiscoveryFromOaaRule(premiumRule, {
    origin: policy.site.origin,
    path: "/premium/report",
    method: "GET",
    policyUrl: `${policy.site.origin}/.well-known/agent-access.json`,
    policyHash,
    output: { example: { ok: true, tier: "premium" } }
  });
  assert.equal(discovery.openAgentAccess.protocol, "open-agent-access");
  assert.equal(discovery.openAgentAccess.policyHash, policyHash);
  assert.equal(discovery.openAgentAccess.ruleId, "premium");
  assert.equal(discovery.openAgentAccess.paymentRequired, true);
  assert.equal(discovery.openAgentAccess.receiptRequired, true);
  assert.equal(discovery.openAgentAccess.resourceBindingHash.length, 64);

  const route = createBazaarResourceRoute({
    accepts: { scheme: "exact", network: "algorand-testnet", price: "$0.005" },
    discovery
  });
  assert.equal(extractOaaPolicyRefFromBazaarExtension(route.extensions)?.ruleId, "premium");

  const importedRule = createOaaRuleFromBazaarDiscovery({
    id: "premium-imported",
    match: { methods: ["GET"], paths: ["/premium/report"] },
    discovery,
    price: premiumRule.price,
    payment: { type: "x402", settlement: "algorand", network: "testnet", scheme: "exact" }
  });
  assert.equal(importedRule.decision, "charge");
  assert.equal(importedRule.receipt?.required, true);
  assert.equal(importedRule.payment?.settlement, "algorand");
});

test("hardening packages sign policies, prove receipt inclusion, prevent replay, and anchor digests", async () => {
  const keys = createPolicySigningKeyPair();
  const signed = signAgentAccessPolicy(policy, {
    keyId: "did:web:example.com#oaa-policy-key-1",
    privateKeyPem: keys.privateKeyPem,
    createdAt: new Date("2026-06-16T00:00:00.000Z")
  });
  const trust = createPolicyTrustRecord({
    keyId: signed.policySignature.keyId,
    publicKeyPem: keys.publicKeyPem,
    controller: "https://example.com"
  });
  assert.equal(trust.kind, "policy-trust-record");
  const verification = verifySignedAgentAccessPolicy(signed, [{
    keyId: signed.policySignature.keyId,
    publicKeyPem: keys.publicKeyPem
  }], { now: new Date("2026-06-16T00:00:00.000Z") });
  assert.equal(verification.ok, true);

  const receiptA = await appendReceipt(join(await mkdtemp(join(tmpdir(), "oaa-hardening-")), "receipts.jsonl"), {
    receiptVersion: "0.1",
    receiptType: "agent_access",
    role: "site",
    traceId: "trace-hardening-a",
    method: "GET",
    url: "https://example.com/docs/a",
    origin: "https://example.com",
    policy: { ruleId: "docs", policyHash: hashCanonicalJson(policy), decision: "allow" },
    payment: { required: false }
  });
  const receiptB = {
    ...receiptA,
    traceId: "trace-hardening-b",
    receiptId: "receipt-b",
    receiptHash: hashCanonicalJson({ receipt: "b" })
  };
  const log = createTransparencyLog([
    receiptToTransparencyEntry(receiptA),
    receiptToTransparencyEntry(receiptB)
  ], new Date("2026-06-16T00:00:00.000Z"));
  assert.equal(log.treeSize, 2);
  const proof = createInclusionProof(log, 1);
  assert.equal(verifyInclusionProof(proof), true);
  const oddLog = createTransparencyLog([
    receiptToTransparencyEntry(receiptA),
    receiptToTransparencyEntry(receiptB),
    { ...receiptToTransparencyEntry(receiptB), digest: hashCanonicalJson({ receipt: "c" }) }
  ], new Date("2026-06-16T00:00:00.000Z"));
  assert.equal(verifyInclusionProof(createInclusionProof(oddLog, 2)), true);

  const resourceHash = buildResourceBindingHash({
    method: "GET",
    url: "https://example.com/premium/report",
    policyHash: hashCanonicalJson(policy),
    ruleId: "premium",
    traceId: "trace-replay",
    idempotencyKey: "idem-1"
  });
  assert.equal(resourceHash.length, 64);
  assert.equal(requireIdempotencyKey({ method: "POST", decision: "charge" }).ok, false);
  const sharedReplay = createSharedMemoryReplayStore();
  const replayKey = buildReplayKey({
    method: "GET",
    url: "https://example.com/premium/report",
    policyHash: hashCanonicalJson(policy),
    ruleId: "premium",
    traceId: "trace-replay",
    idempotencyKey: "idem-1",
    paymentProof: "payment-proof",
    agentId: "did:web:agent.example"
  });
  assert.equal((await checkAndRememberReplay(sharedReplay, replayKey)).replay, false);
  assert.equal((await checkAndRememberReplay(sharedReplay, replayKey)).replay, true);

  const productionReport = evaluateSecurityProfile({
    ...policy,
    expiresAt: "2099-01-01T00:00:00.000Z",
    defaults: {
      ...policy.defaults,
      decision: "review",
      respectRobotsTxt: true,
      requireAgentIdentity: true,
      requirePurpose: true,
      requireReceipt: true
    },
    receipt: { required: true, signing: "optional-v0" },
    rules: policy.rules.map((rule) => ({
      ...rule,
      rateLimit: rule.rateLimit ?? { requests: 30, window: "1m" },
      receipt: { required: true },
      payment: rule.decision === "charge" ? { type: "x402", settlement: "algorand", network: "testnet" } : rule.payment
    }))
  }, "production");
  assert.equal(productionReport.ok, true);

  const policyAnchor = createPolicyAnchorPayload(policy, "testnet", { site: "example" });
  const receiptAnchor = createReceiptAnchorPayload(receiptA, "testnet");
  const rootAnchor = createTransparencyRootAnchorPayload(log, "testnet");
  assert.ok(buildAlgorandAnchorNote(policyAnchor).startsWith("oaa-anchor-v0.1:"));
  assert.equal(verifyAlgorandAnchorRecord(createAlgorandAnchorRecord(receiptAnchor, {
    transactionId: "TX_PLACEHOLDER",
    confirmedRound: 123
  }), { digest: receiptAnchor.digest, network: "testnet", kind: "receipt" }).valid, true);
  assert.equal(verifyAlgorandAnchorRecord(createAlgorandAnchorRecord(rootAnchor), {
    digest: log.rootHash,
    kind: "transparency-root"
  }).valid, true);
});

test("conformance suite passes reference fixtures", async () => {
  const result = await runConformanceSuite();
  assert.equal(result.ok, true);
  assert.ok(result.checks.length >= 8);
});

test("mandate graph validation and fail-closed evaluation", () => {
  const mandates = validateMandateDocument(mandateDocument);
  const allowed = evaluateMandate(mandates, {
    agentId: "did:web:agent.example",
    principal: "user:steve@example.com",
    operator: "Example Labs",
    purpose: "research",
    use: "read",
    method: "GET",
    url: "https://example.com/docs/page",
    tool: "fetch",
    consequence: "public-read",
    budget: { amount: "0.01", currency: "USD" },
    now: new Date("2026-06-12T00:00:00.000Z")
  });
  assert.equal(allowed.decision, "allow");
  assert.ok(allowed.mandateHash);

  const approval = evaluateMandate(mandates, {
    agentId: "did:web:agent.example",
    principal: "user:steve@example.com",
    operator: "Example Labs",
    purpose: "research",
    method: "GET",
    url: "https://example.com/docs/page",
    tool: "fetch",
    consequence: "publish",
    now: new Date("2026-06-12T00:00:00.000Z")
  });
  assert.equal(approval.decision, "deny");
  assert.equal(approval.reason, "consequence_out_of_scope");

  const denied = evaluateMandate(mandates, {
    agentId: "did:web:agent.example",
    principal: "user:steve@example.com",
    operator: "Example Labs",
    purpose: "research",
    method: "GET",
    url: "https://evil.example/docs/page",
    tool: "fetch",
    now: new Date("2026-06-12T00:00:00.000Z")
  });
  assert.equal(denied.decision, "deny");
  assert.equal(denied.reason, "resource_out_of_scope");
});

test("access event trails bind to receipts", async () => {
  const events = appendAccessEvent([
    createAccessEvent({
      traceId: "trace-events",
      type: "policy_discovered",
      actor: { role: "agent", id: "did:web:agent.example" },
      subject: { method: "GET", url: "https://example.com/docs/page" }
    })
  ], {
    traceId: "trace-events",
    type: "policy_decision",
    actor: { role: "site", id: "https://example.com" },
    policy: { ruleId: "docs", policyHash: "policy-hash", decision: "allow" }
  });
  assert.equal(verifyAccessEventTrail(events).valid, true);

  const receipt = attachEventTrailToReceipt({
    receiptVersion: "0.1",
    receiptType: "agent_access",
    role: "agent",
    traceId: "trace-events",
    receiptId: "receipt-events",
    timestamp: "2026-06-12T00:00:00.000Z",
    method: "GET",
    url: "https://example.com/docs/page",
    origin: "https://example.com",
    payment: { required: false }
  }, events);
  assert.equal(receipt.events?.length, 2);
  assert.ok(receipt.eventTrailHash);

  const tampered = [{ ...events[0], type: "denied" as const }, events[1]];
  assert.equal(verifyAccessEventTrail(tampered).valid, false);
});

test("MCP guard enforces policy and mandate before tool calls", async () => {
  const mcpPolicy: AgentAccessPolicy = {
    ...policy,
    site: { name: "MCP", origin: "https://example.com" },
    rules: [
      {
        id: "mcp-docs",
        match: { methods: ["POST"], paths: ["/mcp/tools/docs.search"] },
        decision: "allow",
        purposes: ["research"],
        uses: ["ai-input"]
      }
    ]
  };
  const guard = createAgentAccessMcpToolGuard({
    policy: mcpPolicy,
    mandateDocument,
    serverName: "docs",
    toolUrlBase: "https://example.com/mcp"
  });

  const authorization = guard.authorize({
    toolName: "docs.search",
    purpose: "research",
    use: "ai-input",
    agent: { id: "did:web:agent.example", principal: "user:steve@example.com", operator: "Example Labs" },
    consequence: "public-read",
    budget: { amount: "0.01", currency: "USD" },
    now: new Date("2026-06-12T00:00:00.000Z")
  });
  assert.equal(authorization.allowed, true);
  assert.equal(authorization.receiptContext.toolName, "docs.search");
  assert.equal(authorization.receiptContext.mandate?.mandateId, "research-public");

  const wrapped = guard.wrapTool<{ q: string }, { ok: boolean }>("docs.search", async () => ({ ok: true }));
  assert.deepEqual(await wrapped({ q: "oaa" }, {
    purpose: "research",
    use: "ai-input",
    agent: { id: "did:web:agent.example", principal: "user:steve@example.com", operator: "Example Labs" },
    consequence: "public-read",
    budget: { amount: "0.01", currency: "USD" },
    now: new Date("2026-06-12T00:00:00.000Z")
  }), { ok: true });

  await assert.rejects(() => wrapped({ q: "oaa" }, {
    purpose: "research",
    use: "ai-input",
    agent: { id: "did:web:agent.example", principal: "user:steve@example.com", operator: "Example Labs" },
    consequence: "public-read",
    budget: { amount: "0.01", currency: "USD" },
    url: "https://evil.example/mcp/tools/docs.search",
    now: new Date("2026-06-12T00:00:00.000Z")
  }), McpToolAuthorizationError);
});

test("enterprise controls score posture and export audit evidence", async () => {
  const enterprisePolicy: AgentAccessPolicy = {
    ...policy,
    site: {
      name: "Enterprise",
      origin: "https://example.com",
      securityContact: "mailto:security@example.com"
    },
    defaults: {
      decision: "deny",
      respectRobotsTxt: true,
      requireAgentIdentity: true,
      requirePurpose: true,
      requireReceipt: true
    },
    reviewUrl: "https://example.com/review",
    expiresAt: "2099-01-01T00:00:00.000Z",
    rules: [
      {
        id: "docs",
        match: { methods: ["GET"], paths: ["/docs/**"] },
        decision: "allow",
        purposes: ["research"],
        uses: ["read"],
        deniedUses: ["ai-train"],
        rateLimit: { requests: 60, window: "1m" },
        loadPolicy: { emergencyStop: "https://example.com/.well-known/agent-stop" }
      },
      {
        id: "paid",
        match: { methods: ["GET"], paths: ["/paid/**"] },
        decision: "charge",
        purposes: ["research"],
        uses: ["ai-input"],
        deniedUses: ["ai-train"],
        price: { amount: "0.005", currency: "USD" },
        payment: { type: "x402", settlement: "algorand", network: "testnet" },
        receipt: { required: true },
        rateLimit: { requests: 30, window: "1m" },
        loadPolicy: { emergencyStop: "https://example.com/.well-known/agent-stop" }
      }
    ]
  };
  const report = createEnterpriseControlReport({
    policy: enterprisePolicy,
    mandateDocument,
    now: new Date("2026-06-12T00:00:00.000Z")
  });
  assert.equal(report.ok, true);
  assert.ok(report.score >= 90);

  const weak = createEnterpriseControlReport({
    policy: {
      ...enterprisePolicy,
      defaults: { decision: "allow" },
      rules: [{ id: "paid", decision: "charge" }]
    },
    now: new Date("2026-06-12T00:00:00.000Z")
  });
  assert.equal(weak.ok, false);
  assert.ok(weak.findings.some((finding) => finding.id === "OAA-ENT-001"));

  const risk = assessEnterpriseAccessRisk({
    decision: "charge",
    method: "POST",
    use: "ai-input",
    paymentRequired: true,
    dataSensitivity: "restricted",
    budget: { amount: "2", currency: "USD" }
  });
  assert.equal(risk.level, "critical");
  assert.ok(risk.recommendedControls.includes("idempotency_key"));

  const receipt = attachEventTrailToReceipt({
    receiptVersion: "0.1",
    receiptType: "agent_access",
    role: "agent",
    traceId: "enterprise-trace",
    receiptId: "enterprise-receipt",
    timestamp: "2026-06-12T00:00:00.000Z",
    method: "GET",
    url: "https://example.com/paid/report",
    origin: "https://example.com",
    agent: { id: "did:web:agent.example", principal: "user:steve@example.com" },
    policy: { policyHash: "policy-hash", ruleId: "paid", decision: "charge" },
    payment: { required: true, settlement: "algorand", settlementSuccess: true, payer: "payer" },
    receiptHash: "receipt-hash"
  }, [
    createAccessEvent({ traceId: "enterprise-trace", type: "payment_settled", payment: { transactionId: "tx" } })
  ]);
  const span = receiptToOpenTelemetrySpan(receipt, { redact: true });
  assert.equal(span.name, "oaa.agent_access");
  assert.equal(span.attributes["oaa.policy.decision"], "charge");
  assert.ok(receiptToCefEvent(receipt, { redact: true }).startsWith("CEF:0|Open Agent Access|OAA|0.1|agent_access"));
  const digest = createEvidenceBundleDigest({ policy: enterprisePolicy, mandateDocument, receipts: [receipt] });
  assert.equal(digest.receiptCount, 1);
  assert.equal(digest.eventCount, 1);
  assert.ok(digest.bundleHash);
});

test("immutable evidence bundles verify and write create-only objects", async () => {
  const receipt: Awaited<ReturnType<typeof appendReceipt>> = {
    receiptVersion: "0.1",
    receiptType: "agent_access",
    role: "agent",
    traceId: "evidence-trace",
    receiptId: "evidence-receipt",
    timestamp: "2026-06-12T00:00:00.000Z",
    method: "GET",
    url: "https://example.com/docs/a",
    origin: "https://example.com",
    policy: { policyHash: "policy-hash", ruleId: "docs", decision: "allow" },
    payment: { required: false },
    receiptHash: "receipt-hash"
  };
  const bundle = createEvidenceBundle({
    policy,
    mandateDocument,
    receipts: [receipt],
    events: [
      createAccessEvent({ traceId: "evidence-trace", type: "policy_decision", policy: { decision: "allow" } })
    ],
    createdAt: new Date("2026-06-12T00:00:00.000Z")
  });
  assert.equal(verifyEvidenceBundle(bundle).valid, true);
  assert.equal(bundle.receiptCount, 1);
  assert.equal(bundle.eventCount, 1);

  const store = createMemoryImmutableEvidenceStore();
  const stored = await putImmutableEvidenceBundle(store, bundle, {
    prefix: "enterprise/oaa",
    retentionMode: "compliance",
    retainUntil: "2027-06-12T00:00:00.000Z",
    legalHold: true
  });
  assert.ok(stored.key.startsWith("enterprise/oaa/"));
  await assert.rejects(() => putImmutableEvidenceBundle(store, bundle, { prefix: "enterprise/oaa" }), /immutable_object_exists/);

  const tampered = { ...bundle, receiptHashes: ["tampered"] };
  assert.equal(verifyEvidenceBundle(tampered).valid, false);
});

test("policy-as-code exports OPA and Cedar-style bundles", () => {
  const opa = exportOpaBundle(policy);
  assert.equal(opa.format, "opa");
  assert.ok(opa.rego.includes("package open_agent_access"));
  assert.equal((opa.data as { oaa: { rules: Array<{ id: string }> } }).oaa.rules[0].id, "docs");
  assert.ok(opa.policyHash);

  const cedar = exportCedarBundle(policy);
  assert.equal(cedar.format, "cedar");
  assert.equal(cedar.policies.length, policy.rules.length);
  assert.ok(cedar.policies[0].includes("context.policyHash"));
  assert.ok(cedar.policies.some((entry) => entry.includes("premium")));
});

test("compliance mappings expose framework evidence guidance", () => {
  assert.deepEqual(listComplianceFrameworks(), ["nist-ai-rmf", "eu-ai-act", "soc2", "iso27001", "nis2"]);
  const eu = getComplianceMapping("eu-ai-act", new Date("2026-06-12T00:00:00.000Z"));
  assert.equal(eu.framework, "eu-ai-act");
  assert.ok(eu.disclaimer.includes("not legal advice"));
  assert.ok(eu.controls.some((control) => control.evidence.includes("trust-passport.json")));
  assert.equal(getAllComplianceMappings().length, 5);
});

test("incident stop signals match scoped agent access", () => {
  const signal = validateAgentStopSignal(createAgentStopSignal({
    reason: "publisher_incident",
    retryAfter: 300,
    scope: { paths: ["/premium/**"], purposes: ["research"] },
    issuedAt: new Date("2026-06-12T00:00:00.000Z")
  }));
  const stopped = evaluateStopSignal(signal, {
    path: "/premium/report",
    purpose: "research",
    now: new Date("2026-06-12T00:00:01.000Z")
  });
  assert.equal(stopped.stopped, true);
  assert.equal(stopped.retryAfter, 300);
  assert.equal(evaluateStopSignal(signal, { path: "/free", purpose: "research" }).stopped, false);
  assert.equal(evaluateStopSignal({ ...signal, active: false }, { path: "/premium/report", purpose: "research" }).reason, "stop_inactive");
});

test("policy lint catches unsafe operational gaps", () => {
  const result = lintAgentAccessPolicy({
    ...policy,
    defaults: { decision: "allow", respectRobotsTxt: false },
    rules: [
      {
        id: "paid",
        match: { methods: ["GET"], paths: ["/paid"] },
        decision: "charge"
      }
    ]
  });
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((finding) => finding.code === "unsafe_default_allow"));
  assert.ok(result.findings.some((finding) => finding.code === "charge_without_price"));
  assert.ok(result.findings.some((finding) => finding.code === "charge_without_payment"));
});

test("policy explain reports matching and skipped rules", () => {
  const explanation = explainPolicyDecision(policy, {
    url: "https://example.com/premium/report",
    method: "GET",
    purpose: "research",
    use: "ai-input",
    agent: { id: "did:web:agent.example" }
  });
  assert.equal(explanation.decision.decision, "charge");
  assert.equal(explanation.decision.rule?.id, "premium");
  assert.equal(explanation.rules.find((rule) => rule.ruleId === "premium")?.matched, true);
  assert.equal(explanation.rules.find((rule) => rule.ruleId === "docs")?.pathMatched, false);
});

test("route/path matching", () => {
  assert.equal(pathMatches("/docs/**", "/docs/a/b"), true);
  assert.equal(pathMatches("/docs/**", "/blog/a"), false);
});

test("decision engine allow/deny/default", () => {
  assert.equal(decideAccess(policy, {
    url: "https://example.com/docs/a",
    method: "GET",
    purpose: "research",
    use: "read",
    agent: { id: "did:web:agent.example" }
  }).decision, "allow");

  assert.equal(decideAccess(policy, {
    url: "https://example.com/docs/a",
    method: "GET",
    purpose: "research",
    use: "ai-train",
    agent: { id: "did:web:agent.example" }
  }).decision, "deny");

  assert.equal(decideAccess(policy, {
    url: "https://example.com/unknown",
    method: "GET",
    purpose: "research",
    use: "read",
    agent: { id: "did:web:agent.example" }
  }).decision, "review");

  assert.equal(decideAccess({ ...policy, expiresAt: "2000-01-01T00:00:00Z" }, {
    url: "https://example.com/docs/a",
    method: "GET",
    purpose: "research",
    use: "read",
    agent: { id: "did:web:agent.example" }
  }).reason, "policy_expired");
});

test("budget comparison and canonical hashing", () => {
  assert.equal(budgetAllowsPrice({ amount: "0.05", currency: "USD" }, { amount: "0.005", currency: "USD" }), true);
  assert.equal(budgetAllowsPrice({ amount: "0.001", currency: "USD" }, { amount: "0.005", currency: "USD" }), false);
  assert.equal(hashCanonicalJson({ b: 1, a: 2 }), hashCanonicalJson({ a: 2, b: 1 }));
});

test("agent and site headers", () => {
  const agentHeaders = buildAgentAccessHeaders({
    agent: { id: "did:web:a", name: "A", operator: "Ops", principal: "user:1", contact: "mailto:a@example.com" },
    purpose: "research",
    use: "read",
    budget: { currency: "USD", amount: "0.05" },
    traceId: "trace"
  });
  assert.equal(parseAgentAccessHeaders(agentHeaders)?.agent.id, "did:web:a");
  assert.equal(parseAgentAccessHeaders(agentHeaders)?.budget?.amount, "0.05");

  const siteHeaders = buildSiteDecisionHeaders({
    decision: "allow",
    policyRef: "policy#rule",
    traceId: "trace",
    rateLimitLimit: 10,
    rateLimitRemaining: 9,
    attributionRequired: true,
    retention: "30d",
    receiptId: "receipt"
  });
  assert.equal(parseSiteDecisionHeaders(siteHeaders).decision, "allow");
  assert.equal(parseSiteDecisionHeaders(siteHeaders).receiptId, "receipt");
});

test("signed agent identity verifies request headers", () => {
  const keys = createAgentIdentityKeyPair();
  const headers = buildAgentAccessHeaders({
    agent: { id: "did:web:a", name: "A", operator: "Ops", principal: "user:1" },
    purpose: "research",
    use: "read",
    budget: { currency: "USD", amount: "0.05" },
    traceId: "trace"
  });
  signAgentAccessHeaders(headers, {
    method: "GET",
    url: "https://example.com/docs/a",
    keyId: "did:web:a#key-1",
    privateKeyPem: keys.privateKeyPem,
    createdAt: new Date("2026-06-12T00:00:00.000Z")
  });
  const verified = verifyAgentAccessHeaders(headers, {
    method: "GET",
    url: "https://example.com/docs/a",
    trustedKeys: [{ keyId: "did:web:a#key-1", agentId: "did:web:a", publicKeyPem: keys.publicKeyPem }],
    now: new Date("2026-06-12T00:00:01.000Z")
  });
  assert.equal(verified.ok, true);
  assert.equal(verified.reason, "verified");

  headers.set("AA-Purpose", "ai-train");
  const tampered = verifyAgentAccessHeaders(headers, {
    method: "GET",
    url: "https://example.com/docs/a",
    trustedKeys: [{ keyId: "did:web:a#key-1", agentId: "did:web:a", publicKeyPem: keys.publicKeyPem }],
    now: new Date("2026-06-12T00:00:01.000Z")
  });
  assert.equal(tampered.ok, false);
  assert.equal(tampered.reason, "invalid_signature");

  const timestampTamperHeaders = buildAgentAccessHeaders({
    agent: { id: "did:web:a", name: "A", operator: "Ops", principal: "user:1" },
    purpose: "research",
    use: "read",
    budget: { currency: "USD", amount: "0.05" },
    traceId: "trace"
  });
  signAgentAccessHeaders(timestampTamperHeaders, {
    method: "GET",
    url: "https://example.com/docs/a",
    keyId: "did:web:a#key-1",
    privateKeyPem: keys.privateKeyPem,
    createdAt: new Date("2026-06-12T00:00:00.000Z")
  });
  timestampTamperHeaders.set("AA-Agent-Signature-Created", "2026-06-12T00:00:01.000Z");
  const timestampTampered = verifyAgentAccessHeaders(timestampTamperHeaders, {
    method: "GET",
    url: "https://example.com/docs/a",
    trustedKeys: [{ keyId: "did:web:a#key-1", agentId: "did:web:a", publicKeyPem: keys.publicKeyPem }],
    now: new Date("2026-06-12T00:00:01.000Z")
  });
  assert.equal(timestampTampered.ok, false);
  assert.equal(timestampTampered.reason, "invalid_signature");
});

test("receipt append, verify, digest, and tamper detection", async () => {
  const dir = await mkdtemp(join(tmpdir(), "oaa-"));
  const ledger = join(dir, "receipts.jsonl");
  await appendReceipt(ledger, {
    receiptVersion: "0.1",
    receiptType: "agent_access",
    role: "agent",
    traceId: "trace-1",
    method: "GET",
    url: "https://example.com/a",
    origin: "https://example.com",
    payment: { required: false }
  });
  await appendReceipt(ledger, {
    receiptVersion: "0.1",
    receiptType: "agent_access",
    role: "agent",
    traceId: "trace-2",
    method: "GET",
    url: "https://example.com/b",
    origin: "https://example.com",
    payment: { required: false }
  });
  assert.equal((await readReceiptLedger(ledger)).length, 2);
  assert.equal((await verifyReceiptChain(ledger)).valid, true);
  assert.equal((await exportDigest(ledger)).count, 2);

  const text = await readFile(ledger, "utf8");
  await writeFile(ledger, text.replace("trace-2", "trace-x"), "utf8");
  assert.equal((await verifyReceiptChain(ledger)).valid, false);

  const concurrentLedger = join(dir, "concurrent.jsonl");
  await Promise.all(Array.from({ length: 8 }, (_, index) => appendReceipt(concurrentLedger, {
    receiptVersion: "0.1",
    receiptType: "agent_access",
    role: "agent",
    traceId: `trace-${index}`,
    method: "GET",
    url: `https://example.com/${index}`,
    origin: "https://example.com",
    payment: { required: false }
  })));
  assert.equal((await verifyReceiptChain(concurrentLedger)).valid, true);
  assert.equal((await readReceiptLedger(concurrentLedger)).length, 8);

  const [receipt] = await readReceiptLedger(concurrentLedger);
  const keys = createReceiptSigningKeyPair();
  const signed = signReceipt(receipt, keys.privateKeyPem, keys.publicKeyPem);
  assert.equal(verifyReceiptSignature(signed), true);
  assert.equal(verifyReceiptSignature({ ...signed, traceId: "tampered" }), false);

  const agentLedger = join(dir, "agent.jsonl");
  const siteLedger = join(dir, "site.jsonl");
  const shared = {
    receiptVersion: "0.1" as const,
    receiptType: "agent_access" as const,
    traceId: "shared-trace",
    method: "GET",
    url: "https://example.com/premium/report",
    origin: "https://example.com",
    policy: { ruleId: "premium", policyHash: "policy-hash", decision: "charge" as const },
    payment: { required: true, type: "x402", settlement: "algorand", network: "testnet", price: { amount: "0.005", currency: "USD" } }
  };
  await appendReceipt(agentLedger, { ...shared, role: "agent" });
  await appendReceipt(siteLedger, { ...shared, role: "site" });
  assert.equal((await reconcileReceiptLedgers(agentLedger, siteLedger)).valid, true);

  const mismatchSiteLedger = join(dir, "site-mismatch.jsonl");
  await appendReceipt(mismatchSiteLedger, {
    ...shared,
    role: "site",
    policy: { ...shared.policy, decision: "deny" }
  });
  const reconciliation = await reconcileReceiptLedgers(agentLedger, mismatchSiteLedger);
  assert.equal(reconciliation.valid, false);
  assert.equal(reconciliation.mismatches[0].field, "policy.decision");
});

test("production replay store adapters", async () => {
  const redisData = new Map<string, string>();
  const redis = createRedisReplayStore({
    get(key) {
      return redisData.get(key) ?? null;
    },
    set(key, value) {
      redisData.set(key, value);
      return "OK";
    }
  });
  assert.equal(await redis.has("abc"), false);
  await redis.set("abc", 1000);
  assert.equal(await redis.has("abc"), true);

  const postgresData = new Set<string>();
  const postgres = createPostgresReplayStore({
    async query(sql: string, params?: unknown[]) {
      if (sql.startsWith("insert")) {
        postgresData.add(params?.[0] as string);
        return { rowCount: 1 };
      }
      if (sql.startsWith("select")) {
        return { rowCount: postgresData.has(params?.[0] as string) ? 1 : 0 };
      }
      return { rowCount: 0 };
    }
  });
  assert.ok(createPostgresReplayTableSql().includes("create table"));
  assert.equal(await postgres.has("def"), false);
  await postgres.set("def", 1000);
  assert.equal(await postgres.has("def"), true);
});

test("Algorand x402 adapter guardrails and metadata", async () => {
  assert.equal(validateAlgorandX402Config({ enabled: false }).valid, true);
  assert.equal(validateAlgorandX402Config({ enabled: true, network: "badnet", signer: {} }).errors.includes("unsupported_algorand_network"), true);
  assert.equal(validateAlgorandX402Config({ enabled: true, signer: {}, facilitatorUrl: "http://example.com" }).errors.includes("facilitator_url_must_use_https"), true);
  await assert.rejects(() => wrapFetchWithAlgorandX402Payment(fetch, { enabled: false }), /disabled/);
  await assert.rejects(() => wrapFetchWithAlgorandX402Payment(fetch, {
    enabled: true,
    signer: {},
    budget: { amount: "0.001", currency: "USD" },
    price: { amount: "0.005", currency: "USD" }
  }), /budget/);
  const accepts = buildAlgorandX402Accepts({
    enabled: true,
    payTo: "TESTADDR",
    price: { amount: "0.005", currency: "USD" },
    asset: "USDC",
    assetId: "123"
  });
  assert.equal(accepts[0].scheme, "exact");
  assert.equal(accepts[0].maxAmountRequired, "$0.005");
  const settlement = parseAlgorandX402SettlementHeaders(new Headers({
    "X-PAYMENT-RESPONSE": JSON.stringify({ transactionId: "tx", payer: "payer", payTo: "payto" })
  }));
  assert.equal(settlement.transactionId, "tx");
  assert.equal(parseAlgorandX402SettlementHeaders(new Headers({ "X-PAYMENT-RESPONSE": "not-json" })).settlementSuccess, false);
  assert.equal(createAlgorandX402PaymentRequiredFixture().status, 402);
  assert.equal(parseAlgorandX402SettlementHeaders(createAlgorandX402SettlementFixture({ transactionId: "fixture-tx" })).transactionId, "fixture-tx");
  assert.equal(parseAlgorandX402SettlementHeaders(createMalformedAlgorandX402SettlementFixture()).settlementSuccess, false);
});

test("Algorand x402 TestNet readiness is explicit and secret-safe", async () => {
  const readiness = await runAlgorandX402TestnetCheck({
    env: {
      AVM_MNEMONIC: "test mnemonic must not appear",
      AVM_ADDRESS: "TESTADDR",
      USDC_TESTNET_ASA_ID: "123",
      FACILITATOR_URL: "https://facilitator.example"
    }
  });
  assert.equal(readiness.checks.find((check) => check.name === "AVM_MNEMONIC")?.detail.includes("test mnemonic"), false);
  assert.equal(readiness.checks.find((check) => check.name === "FACILITATOR_URL")?.ok, true);

  const gated = await runAlgorandX402TestnetCheck({
    live: true,
    env: {
      AVM_MNEMONIC: "secret",
      AVM_ADDRESS: "TESTADDR",
      USDC_TESTNET_ASA_ID: "123",
      FACILITATOR_URL: "https://facilitator.example"
    }
  });
  assert.equal(gated.live, false);
  assert.equal(gated.checks.find((check) => check.name === "live-gate")?.ok, false);

  const live = await runAlgorandX402TestnetCheck({
    live: true,
    env: {
      OAA_LIVE_X402_TESTS: "true",
      AVM_MNEMONIC: "secret",
      AVM_ADDRESS: "TESTADDR",
      USDC_TESTNET_ASA_ID: "123",
      FACILITATOR_URL: "https://facilitator.example"
    },
    fetch: async () => new Response(null, { status: 204 })
  });
  assert.equal(live.live, true);
  assert.equal(live.checks.find((check) => check.name === "facilitator-reachable")?.ok, true);
});

test("Express and Fastify adapters enforce policies", async () => {
  const dir = await mkdtemp(join(tmpdir(), "oaa-framework-"));
  const policyPath = join(dir, "agent-access.json");
  const expressLedger = join(dir, "express.jsonl");
  const fastifyLedger = join(dir, "fastify.jsonl");
  await writeFile(policyPath, JSON.stringify({
    version: "0.1",
    protocol: "open-agent-access",
    site: { name: "Framework", origin: "http://localhost" },
    defaults: { decision: "deny", requireAgentIdentity: true, requirePurpose: true },
    rules: [
      { id: "free", match: { methods: ["GET"], paths: ["/free"] }, decision: "allow", purposes: ["research"], uses: ["read"], rateLimit: { requests: 20, window: "1m" } },
      { id: "paid", match: { methods: ["GET"], paths: ["/paid"] }, decision: "charge", purposes: ["research"], uses: ["ai-input"], price: { amount: "0.005", currency: "USD" }, payment: { type: "x402", settlement: "algorand", network: "testnet" } }
    ]
  }), "utf8");

  const headers = headersToObject(buildAgentAccessHeaders({
    agent: { id: "did:web:agent.example" },
    purpose: "research",
    use: "read",
    traceId: "framework-trace"
  }));

  let expressNextCalled = false;
  const expressStatus: { code?: number; body?: unknown; headers: Record<string, string> } = { headers: {} };
  await agentAccessExpressMiddleware({ policyPath, receipts: { type: "jsonl", path: expressLedger } })(
    { method: "GET", protocol: "http", originalUrl: "/free", headers, get: (name) => name === "host" ? "localhost" : undefined },
    {
      status(code) {
        expressStatus.code = code;
        return this;
      },
      setHeader(name, value) {
        expressStatus.headers[name] = value;
      },
      json(body) {
        expressStatus.body = body;
      }
    },
    () => {
      expressNextCalled = true;
    }
  );
  assert.equal(expressNextCalled, true);
  assert.equal(expressStatus.headers["aa-decision"], "allow");
  assert.equal((await readReceiptLedger(expressLedger)).length, 1);

  const fastifySent: { code?: number; body?: unknown; headers: Record<string, string> } = { headers: {} };
  const paidHeaders = { ...headers, "aa-use": "ai-input" };
  await createAgentAccessFastifyHook({ policyPath, receipts: { type: "jsonl", path: fastifyLedger } })(
    { method: "GET", url: "/paid", protocol: "http", hostname: "localhost", headers: paidHeaders },
    {
      header(name, value) {
        fastifySent.headers[name] = value;
        return this;
      },
      code(statusCode) {
        fastifySent.code = statusCode;
        return this;
      },
      send(body) {
        fastifySent.body = body;
      }
    }
  );
  assert.equal(fastifySent.code, 402);
  assert.equal(fastifySent.headers["aa-decision"], "charge");
  assert.equal((await readReceiptLedger(fastifyLedger)).length, 1);
});

test("Cloudflare adapter enforces inline policy", async () => {
  const receipts: unknown[] = [];
  const handler = withAgentAccessCloudflare({
    policy: {
      version: "0.1",
      protocol: "open-agent-access",
      site: { name: "Worker", origin: "https://worker.example" },
      defaults: { decision: "deny", requireAgentIdentity: true, requirePurpose: true },
      rules: [
        { id: "free", match: { methods: ["GET"], paths: ["/free"] }, decision: "allow", purposes: ["research"], uses: ["read"], rateLimit: { requests: 20, window: "1m" } },
        { id: "paid", match: { methods: ["GET"], paths: ["/paid"] }, decision: "charge", purposes: ["research"], uses: ["ai-input"], price: { amount: "0.005", currency: "USD" }, payment: { type: "x402", settlement: "algorand", network: "testnet" } }
      ]
    },
    receiptSink(receipt) {
      receipts.push(receipt);
    }
  }, async () => Response.json({ ok: true }));

  const freeHeaders = buildAgentAccessHeaders({
    agent: { id: "did:web:agent.example" },
    purpose: "research",
    use: "read",
    traceId: "worker-trace"
  });
  const free = await handler(new Request("https://worker.example/free", { headers: freeHeaders }), {}, {});
  assert.equal(free.status, 200);
  assert.equal(free.headers.get("AA-Decision"), "allow");

  const paidHeaders = buildAgentAccessHeaders({
    agent: { id: "did:web:agent.example" },
    purpose: "research",
    use: "ai-input",
    traceId: "worker-paid-trace"
  });
  const paid = await handler(new Request("https://worker.example/paid", { headers: paidHeaders }), {}, {});
  assert.equal(paid.status, 402);
  assert.equal(paid.headers.get("AA-Decision"), "charge");
  assert.equal(receipts.length, 2);
});

test("Vercel adapter protects static publisher routes with human fallback", async () => {
  const receipts: unknown[] = [];
  const middleware = createAgentAccessVercelMiddleware({
    protectedPaths: ["/essays/:path*"],
    humanFallback: "allow",
    policy: {
      version: "0.1",
      protocol: "open-agent-access",
      site: { name: "Publisher", origin: "https://publisher.example" },
      defaults: { decision: "review", requireAgentIdentity: true, requirePurpose: true },
      rules: [
        {
          id: "essays-agent-passport-required",
          match: { methods: ["GET"], paths: ["/essays/**"] },
          decision: "allow",
          purposes: ["research"],
          uses: ["read", "summarize"],
          deniedUses: ["ai-train"]
        }
      ]
    },
    receiptSink(receipt) {
      receipts.push(receipt);
    }
  });

  const human = await middleware(new Request("https://publisher.example/essays/", {
    headers: { accept: "text/html", "user-agent": "Mozilla/5.0" }
  }));
  assert.equal(human.status, 200);
  assert.equal(human.headers.get("x-middleware-next"), "1");
  assert.equal(human.headers.get("AA-Decision"), "human_fallback");

  const undecidedAgent = await middleware(new Request("https://publisher.example/essays/", {
    headers: { "user-agent": "ResearchAgent/1.0", "aa-agent-id": "did:web:agent.example" }
  }));
  assert.equal(undecidedAgent.status, 403);
  assert.equal(undecidedAgent.headers.get("AA-Decision"), "review");

  const allowedHeaders = buildAgentAccessHeaders({
    agent: { id: "did:web:agent.example" },
    purpose: "research",
    use: "read",
    traceId: "vercel-trace"
  });
  const allowed = await middleware(new Request("https://publisher.example/essays/", { headers: allowedHeaders }));
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get("AA-Decision"), "allow");
  assert.equal(receipts.length, 2);
});

test("Hono middleware decisions and receipts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "oaa-hono-"));
  const policyPath = join(dir, "agent-access.json");
  const ledgerPath = join(dir, "site-receipts.jsonl");
  await writeFile(policyPath, JSON.stringify({
    version: "0.1",
    protocol: "open-agent-access",
    site: { name: "Test", origin: "http://localhost" },
    defaults: { decision: "deny", requireAgentIdentity: true, requirePurpose: true },
    rules: [
      { id: "free", match: { methods: ["GET"], paths: ["/free"] }, decision: "allow", purposes: ["research"], uses: ["read"], rateLimit: { requests: 2, window: "1m" } },
      { id: "deny", match: { methods: ["GET"], paths: ["/deny"] }, decision: "deny", purposes: ["research"], uses: ["read"] },
      { id: "throttle", match: { methods: ["GET"], paths: ["/throttle"] }, decision: "allow", purposes: ["research"], uses: ["read"], rateLimit: { requests: 1, window: "1m" } },
      { id: "paid", match: { methods: ["GET"], paths: ["/paid"] }, decision: "charge", purposes: ["research"], uses: ["ai-input"], price: { amount: "0.005", currency: "USD" }, payment: { type: "x402", settlement: "algorand", network: "testnet" } }
    ]
  }), "utf8");

  const app = new Hono();
  const replayKeys = new Set<string>();
  const replayStore: ReplayStore = {
    has(key) {
      return replayKeys.has(key);
    },
    set(key) {
      replayKeys.add(key);
    }
  };
  app.use("*", agentAccessMiddleware({
    policyPath,
    receipts: { type: "jsonl", path: ledgerPath },
    replayStore,
    algorandX402: { enabled: true, payTo: "TESTADDR", facilitatorUrl: "https://facilitator.goplausible.xyz", network: "testnet" }
  }));
  app.get("/free", (c) => c.json({ ok: true }));
  app.get("/deny", (c) => c.json({ ok: true }));
  app.get("/throttle", (c) => c.json({ ok: true }));
  app.get("/paid", (c) => c.json({ ok: true }));

  const headers = buildAgentAccessHeaders({
    agent: { id: "did:web:agent.example" },
    purpose: "research",
    use: "read",
    traceId: "trace"
  });

  const free = await app.request("/free", { headers });
  assert.equal(free.status, 200);
  assert.equal(free.headers.get("AA-Decision"), "allow");
  assert.equal(free.headers.get("X-Content-Type-Options"), "nosniff");
  assert.ok(free.headers.get("AA-Policy-Hash"));
  assert.ok(free.headers.get("AA-Payment-Resource"));
  assert.equal((await readReceiptLedger(ledgerPath)).length, 1);

  const denied = await app.request("/deny", { headers });
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get("AA-Decision"), "deny");

  await app.request("/throttle", { headers });
  const throttled = await app.request("/throttle", { headers });
  assert.equal(throttled.status, 429);
  assert.ok(throttled.headers.get("Retry-After"));

  const paidHeaders = new Headers(headers);
  paidHeaders.set("AA-Use", "ai-input");
  const unpaid = await app.request("/paid", { headers: paidHeaders });
  assert.equal(unpaid.status, 402);
  assert.equal(unpaid.headers.get("AA-Decision"), "charge");

  paidHeaders.set("X-PAYMENT", "test-proof");
  const unverifiedPayment = await app.request("/paid", { headers: paidHeaders });
  assert.equal(unverifiedPayment.status, 402);
  assert.equal((await unverifiedPayment.json() as { error: string }).error, "payment_verification_required");

  const trustedReplayKeys = new Set<string>();
  const trustedReplayStore: ReplayStore = {
    has(key) {
      return trustedReplayKeys.has(key);
    },
    set(key) {
      trustedReplayKeys.add(key);
    }
  };
  const trustedApp = new Hono();
  trustedApp.use("*", agentAccessMiddleware({
    policyPath,
    receipts: { type: "jsonl", path: join(dir, "trusted-receipts.jsonl") },
    replayStore: trustedReplayStore,
    algorandX402: {
      enabled: true,
      payTo: "TESTADDR",
      facilitatorUrl: "https://facilitator.goplausible.xyz",
      network: "testnet",
      trustPaymentHeader: true
    }
  }));
  trustedApp.get("/paid", (c) => c.json({ ok: true }));

  const paid = await trustedApp.request("/paid", { headers: paidHeaders });
  assert.equal(paid.status, 200);

  const replay = await trustedApp.request("/paid", { headers: paidHeaders });
  assert.equal(replay.status, 409);
  assert.equal((await replay.json() as { error: string }).error, "payment_replay_detected");
});

test("Hono middleware can require signed agent identity", async () => {
  const dir = await mkdtemp(join(tmpdir(), "oaa-hono-identity-"));
  const policyPath = join(dir, "agent-access.json");
  const ledgerPath = join(dir, "site-receipts.jsonl");
  await writeFile(policyPath, JSON.stringify({
    version: "0.1",
    protocol: "open-agent-access",
    site: { name: "Signed", origin: "http://localhost" },
    defaults: { decision: "deny", requireAgentIdentity: true, requirePurpose: true },
    rules: [
      { id: "signed", match: { methods: ["GET"], paths: ["/signed"] }, decision: "allow", purposes: ["research"], uses: ["read"] }
    ]
  }), "utf8");

  const keys = createAgentIdentityKeyPair();
  const app = new Hono();
  app.use("*", agentAccessMiddleware({
    policyPath,
    receipts: { type: "jsonl", path: ledgerPath },
    agentIdentity: {
      required: true,
      trustedKeys: [{ keyId: "did:web:agent.example#key-1", agentId: "did:web:agent.example", publicKeyPem: keys.publicKeyPem }]
    }
  }));
  app.get("/signed", (c) => c.json({ ok: true }));

  const unsignedHeaders = buildAgentAccessHeaders({
    agent: { id: "did:web:agent.example" },
    purpose: "research",
    use: "read",
    traceId: "unsigned"
  });
  const unsigned = await app.request("http://localhost/signed", { headers: unsignedHeaders });
  assert.equal(unsigned.status, 401);
  assert.equal(unsigned.headers.get("AA-Agent-Identity-Verified"), "false");

  const signedHeaders = buildAgentAccessHeaders({
    agent: { id: "did:web:agent.example" },
    purpose: "research",
    use: "read",
    traceId: "signed"
  });
  signAgentAccessHeaders(signedHeaders, {
    method: "GET",
    url: "http://localhost/signed",
    keyId: "did:web:agent.example#key-1",
    privateKeyPem: keys.privateKeyPem
  });
  const signed = await app.request("http://localhost/signed", { headers: signedHeaders });
  assert.equal(signed.status, 200);
  assert.equal(signed.headers.get("AA-Agent-Identity-Verified"), "true");
});

test("agent action guard enforces one-time human approval for production-facing mutations", async () => {
  const repo = await createGuardFixture("approval");
  await writeFile(join(repo, "src.ts"), "export const value = 1;\n", "utf8");

  const packet = await generateDiffPacket({ repoPath: repo, action: "git.push" });
  assert.equal(packet.actionClass, "push");
  assert.equal(packet.riskLevel, "high");
  assert.deepEqual(packet.changedFiles, ["src.ts"]);
  assert.equal(packet.diffHash.length, 64);

  const readDecision = await guardAction({ repoPath: repo, action: "repo.read" });
  assert.equal(readDecision.ok, true);
  assert.equal(readDecision.reason, "low_risk_action_allowed_without_approval");

  const blocked = await guardAction({ repoPath: repo, action: "git.push" });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, "approval_token_required");

  const malformed = await guardAction({
    repoPath: repo,
    action: "git.push",
    approvalToken: "../../outside.not-a-token"
  });
  assert.equal(malformed.ok, false);
  assert.equal(malformed.reason, "malformed_approval_token");

  const approval = await createApprovalToken({
    repoPath: repo,
    action: "git.push",
    note: "Human reviewed the bounded diff packet.",
    ttlMinutes: 30,
    actor: "test-human"
  });
  assert.match(approval.token, /^[^.]+\./);

  const allowed = await guardAction({
    repoPath: repo,
    action: "git.push",
    approvalToken: approval.token,
    actor: "test-agent"
  });
  assert.equal(allowed.ok, true);
  assert.equal(allowed.reason, "approval_token_accepted");
  assert.equal(allowed.approval?.consumed, true);
  const usedMarker = JSON.parse(await readFile(join(repo, ".oaa", "used-tokens", `${approval.tokenId}.json`), "utf8")) as { tokenId: string };
  assert.equal(usedMarker.tokenId, approval.tokenId);

  const reused = await guardAction({
    repoPath: repo,
    action: "git.push",
    approvalToken: approval.token,
    actor: "test-agent"
  });
  assert.equal(reused.ok, false);
  assert.equal(reused.reason, "approval_token_already_used");

  const verification = await verifyApprovalLedger(join(repo, ".oaa", "approval-ledger.jsonl"));
  assert.equal(verification.valid, true);
  assert.equal(verification.records.some((record) => record.recordType === "approval_used"), true);
});

test("agent action guard rejects expired and stale approval tokens", async () => {
  const repo = await createGuardFixture("stale");
  await writeFile(join(repo, "README.md"), "# changed after approval\n", "utf8");
  const expired = await createApprovalToken({
    repoPath: repo,
    action: "git.push",
    note: "Human approved this deliberately expired token.",
    ttlMinutes: 0.000001
  });
  await sleep(20);
  const expiredDecision = await guardAction({ repoPath: repo, action: "git.push", approvalToken: expired.token });
  assert.equal(expiredDecision.ok, false);
  assert.equal(expiredDecision.reason, "approval_token_expired");

  const fresh = await createApprovalToken({
    repoPath: repo,
    action: "git.push",
    note: "Human reviewed the first diff packet.",
    ttlMinutes: 30
  });
  await writeFile(join(repo, "README.md"), "# changed again after approval\n", "utf8");
  const stale = await guardAction({ repoPath: repo, action: "git.push", approvalToken: fresh.token });
  assert.equal(stale.ok, false);
  assert.equal(stale.reason, "approval_diff_hash_mismatch");

  const untrackedRepo = await createGuardFixture("untracked-stale");
  await writeFile(join(untrackedRepo, "draft.txt"), "approved content\n", "utf8");
  const untracked = await createApprovalToken({
    repoPath: untrackedRepo,
    action: "git.push",
    note: "Human reviewed the untracked file content.",
    ttlMinutes: 30
  });
  await writeFile(join(untrackedRepo, "draft.txt"), "changed after approval\n", "utf8");
  const untrackedStale = await guardAction({ repoPath: untrackedRepo, action: "git.push", approvalToken: untracked.token });
  assert.equal(untrackedStale.ok, false);
  assert.equal(untrackedStale.reason, "approval_diff_hash_mismatch");
});

test("freeze mode blocks approved production-facing actions and reports status", async () => {
  const repo = await createGuardFixture("freeze");
  await writeFile(join(repo, "vercel.json"), "{\"version\":2}\n", "utf8");
  const approval = await createApprovalToken({
    repoPath: repo,
    action: "vercel.deploy",
    note: "Human reviewed the deployment packet.",
    ttlMinutes: 30
  });
  const freeze = await setFreezeState({
    repoPath: repo,
    active: true,
    reason: "Incident review",
    actor: "test-human"
  });
  assert.equal(freeze.active, true);

  const blocked = await guardAction({
    repoPath: repo,
    action: "vercel.deploy",
    approvalToken: approval.token
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, "freeze_active");

  const status = await getGuardStatus({ repoPath: repo });
  assert.equal(status.freeze.active, true);
  assert.equal(status.ledger.valid, true);
});

test("guard helpers generate enforcement artifacts for hooks, GitHub rulesets, and Vercel reconciliation", async () => {
  const repo = await createGuardFixture("artifacts");
  await writeFile(join(repo, "deploy.yml"), "target: production\n", "utf8");
  const packet = await generateDiffPacket({ repoPath: repo, action: "vercel.deploy" });
  assert.equal(packet.highRiskFiles.some((file) => file.path === "deploy.yml"), true);

  const approval = await createApprovalToken({
    repoPath: repo,
    action: "vercel.deploy",
    note: "Human reviewed the deployment diff packet.",
    ttlMinutes: 30
  });
  const deployed = await guardAction({ repoPath: repo, action: "vercel.deploy", approvalToken: approval.token });
  assert.equal(deployed.ok, true);

  const reconciliation = await reconcileVercelDeploymentApproval({
    repoPath: repo,
    productionCommit: packet.repo.head,
    deploymentUrl: "https://example.vercel.app"
  });
  assert.equal(reconciliation.ok, true);

  const hook = await installGitPrePushHook({ repoPath: repo });
  assert.equal(hook.path.endsWith("pre-push"), true);
  const hookScript = await readFile(hook.path, "utf8");
  assert.equal(hookScript.includes("mktemp"), true);
  assert.equal(hookScript.includes("/tmp/oaa-guard-pre-push.json"), false);
  await assert.rejects(
    () => installGitPrePushHook({ repoPath: repo, tokenEnvVar: "BAD;echo injected" }),
    /valid shell environment variable/
  );

  const ruleset = createGitHubRulesetTemplate({ branch: "main", requiredChecks: ["CI", "CodeQL"], requireSignedCommits: true });
  assert.equal(ruleset.enforcement, "active");
  assert.equal(ruleset.rules.some((rule) => rule.type === "non_fast_forward"), true);
  assert.equal(ruleset.rules.some((rule) => rule.type === "required_signatures"), true);
  const pullRequestRule = ruleset.rules.find((rule) => rule.type === "pull_request");
  assert.equal(pullRequestRule?.parameters?.required_approving_review_count, 1);
});

test("Hono middleware can enforce emergency stop signals", async () => {
  const dir = await mkdtemp(join(tmpdir(), "oaa-hono-stop-"));
  const policyPath = join(dir, "agent-access.json");
  const stopPath = join(dir, "agent-stop.json");
  await writeFile(policyPath, JSON.stringify({
    version: "0.1",
    protocol: "open-agent-access",
    site: { name: "Stop", origin: "http://localhost" },
    defaults: { decision: "deny", requireAgentIdentity: true, requirePurpose: true },
    rules: [
      { id: "premium", match: { methods: ["GET"], paths: ["/premium/**"] }, decision: "allow", purposes: ["research"], uses: ["read"] }
    ]
  }), "utf8");
  await writeFile(stopPath, JSON.stringify(createAgentStopSignal({
    reason: "incident_response",
    retryAfter: 120,
    scope: { paths: ["/premium/**"] }
  })), "utf8");

  const app = new Hono();
  app.use("*", agentAccessMiddleware({ policyPath, emergencyStopPath: stopPath }));
  app.get("/premium/report", (c) => c.json({ ok: true }));
  const headers = buildAgentAccessHeaders({
    agent: { id: "did:web:agent.example" },
    purpose: "research",
    use: "read",
    traceId: "stop-trace"
  });
  const stopped = await app.request("http://localhost/premium/report", { headers });
  assert.equal(stopped.status, 503);
  assert.equal(stopped.headers.get("AA-Emergency-Stop"), "true");
  assert.equal(stopped.headers.get("Retry-After"), "120");
});

let passed = 0;
for (const entry of tests) {
  try {
    await entry.fn();
    passed += 1;
    console.log(`ok ${passed} - ${entry.name}`);
  } catch (error) {
    console.error(`not ok ${passed + 1} - ${entry.name}`);
    console.error(error);
    process.exitCode = 1;
    break;
  }
}

if (!process.exitCode) {
  console.log(`\n${passed}/${tests.length} tests passed`);
}

process.exit(process.exitCode ?? 0);

async function createGuardFixture(name: string): Promise<string> {
  const repo = await mkdtemp(join(tmpdir(), `oaa-guard-${name}-`));
  execFileSync("git", ["init", "-b", "main"], { cwd: repo, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "tests@example.com"], { cwd: repo, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "OAA Tests"], { cwd: repo, stdio: "ignore" });
  await writeFile(join(repo, "README.md"), "# OAA guard fixture\n", "utf8");
  execFileSync("git", ["add", "README.md"], { cwd: repo, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", "initial"], { cwd: repo, stdio: "ignore" });
  return repo;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function headersToObject(headers: Headers): Record<string, string> {
  const output: Record<string, string> = {};
  headers.forEach((value, key) => {
    output[key] = value;
  });
  return output;
}
