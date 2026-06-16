import type { AgentAccessPolicy, AgentAccessRule, PaymentPolicy, PricePolicy } from "@kirkelabs/open-agent-access-core";

export type IndustryProfileKind = "publishing-data" | "saas-api" | "supply-chain" | "healthcare" | "energy-infrastructure";

export interface IndustryProfilePolicy {
  profileVersion: "0.1";
  profile: IndustryProfileKind;
  policy: AgentAccessPolicy;
  references: Record<string, string | undefined>;
  cautions: string[];
}

export interface ProfileBaseOptions {
  siteName: string;
  origin: string;
  contact?: string;
  terms?: string;
  reviewUrl?: string;
}

export interface PaidOption {
  price: PricePolicy;
  payment?: PaymentPolicy;
}

export function createPublishingDataProfilePolicy(options: ProfileBaseOptions & {
  publicPaths?: string[];
  premiumPaths?: string[];
  rslLicenseUrl?: string;
  c2paManifestUrl?: string;
  paid?: PaidOption;
}): IndustryProfilePolicy {
  const rules: AgentAccessRule[] = [
    {
      id: "publishing-public-research",
      match: { methods: ["GET"], paths: options.publicPaths ?? ["/articles/**", "/docs/**"] },
      decision: "allow",
      purposes: ["research", "accessibility", "indexing"],
      uses: ["read", "summarize", "quote", "ai-input"],
      deniedUses: ["ai-training", "model-training"],
      attribution: { required: true, format: "source-url" },
      quoteLimit: { maxWords: 100 },
      receipt: { required: true }
    },
    {
      id: "publishing-ai-training-denied",
      match: { methods: ["GET"], paths: ["/**"] },
      decision: "deny",
      deniedPurposes: ["ai-training", "model-training"],
      deniedUses: ["ai-training", "model-training"],
      receipt: { required: true }
    }
  ];
  if (options.paid) {
    rules.push({
      id: "publishing-premium-paid-access",
      match: { methods: ["GET"], paths: options.premiumPaths ?? ["/premium/**", "/archive/**"] },
      decision: "charge",
      purposes: ["research", "monitoring", "agentic-commerce"],
      uses: ["read", "summarize", "ai-input"],
      price: options.paid.price,
      payment: options.paid.payment,
      attribution: { required: true, format: "source-url" },
      receipt: { required: true }
    });
  }
  return profile("publishing-data", options, rules, {
    rslLicenseUrl: options.rslLicenseUrl,
    c2paManifestUrl: options.c2paManifestUrl
  }, ["Does not replace publisher contracts, copyright ownership analysis, or collective licensing terms."]);
}

export function createSaasApiProfilePolicy(options: ProfileBaseOptions & {
  freePaths?: string[];
  premiumPaths?: string[];
  paid?: PaidOption;
}): IndustryProfilePolicy {
  const rules: AgentAccessRule[] = [
    {
      id: "saas-api-free-agent-read",
      match: { methods: ["GET"], paths: options.freePaths ?? ["/api/public/**"] },
      decision: "allow",
      purposes: ["research", "monitoring", "agentic-commerce"],
      uses: ["read", "api-call"],
      rateLimit: { requests: 60, window: "1m", burst: 10, respectRetryAfter: true },
      receipt: { required: true }
    },
    {
      id: "saas-api-mutating-review",
      match: { methods: ["POST", "PUT", "PATCH", "DELETE"], paths: ["/api/**"] },
      decision: "review",
      purposes: ["agentic-commerce", "workflow-automation"],
      uses: ["api-call", "write"],
      reviewUrl: options.reviewUrl,
      receipt: { required: true }
    }
  ];
  if (options.paid) {
    rules.push({
      id: "saas-api-premium-paid",
      match: { methods: ["GET", "POST"], paths: options.premiumPaths ?? ["/api/premium/**"] },
      decision: "charge",
      purposes: ["research", "monitoring", "agentic-commerce"],
      uses: ["api-call", "ai-input"],
      price: options.paid.price,
      payment: options.paid.payment,
      rateLimit: { requests: 30, window: "1m", burst: 5, respectRetryAfter: true },
      receipt: { required: true }
    });
  }
  return profile("saas-api", options, rules, {}, ["Does not replace OAuth, user authorization, data-processing agreements, or API abuse monitoring."]);
}

export function createSupplyChainProductProfilePolicy(options: ProfileBaseOptions & {
  productPaths?: string[];
  gs1DigitalLinkBase?: string;
  epcisUrl?: string;
}): IndustryProfilePolicy {
  return profile("supply-chain", options, [
    {
      id: "supply-chain-product-passport-read",
      match: { methods: ["GET"], paths: options.productPaths ?? ["/products/**", "/digital-link/**"] },
      decision: "allow",
      purposes: ["traceability", "procurement", "sustainability", "research"],
      uses: ["read", "verify", "ai-input"],
      attribution: { required: true, format: "source-url" },
      receipt: { required: true }
    },
    {
      id: "supply-chain-private-events-review",
      match: { methods: ["GET", "POST"], paths: ["/epcis/**", "/events/**"] },
      decision: "review",
      purposes: ["traceability", "audit", "procurement"],
      uses: ["read", "verify", "write"],
      reviewUrl: options.reviewUrl,
      receipt: { required: true }
    }
  ], {
    gs1DigitalLinkBase: options.gs1DigitalLinkBase,
    epcisUrl: options.epcisUrl
  }, ["Does not replace product liability, supplier verification, customs compliance, or EPCIS source-system controls."]);
}

export function createHealthcareConsentProfilePolicy(options: ProfileBaseOptions & {
  fhirBaseUrl?: string;
  patientPaths?: string[];
}): IndustryProfilePolicy {
  return profile("healthcare", options, [
    {
      id: "healthcare-public-metadata",
      match: { methods: ["GET"], paths: ["/metadata", "/.well-known/**"] },
      decision: "allow",
      purposes: ["discovery", "interoperability"],
      uses: ["read"],
      receipt: { required: true }
    },
    {
      id: "healthcare-patient-data-human-review",
      match: { methods: ["GET", "POST"], paths: options.patientPaths ?? ["/fhir/Patient/**", "/fhir/Observation/**", "/fhir/DocumentReference/**"] },
      decision: "review",
      purposes: ["care", "patient-authorized-research", "operations"],
      uses: ["read", "write", "ai-input"],
      reviewUrl: options.reviewUrl,
      receipt: { required: true, signing: "optional-v0" }
    },
    {
      id: "healthcare-ai-training-denied",
      match: { methods: ["GET", "POST"], paths: ["/fhir/**"] },
      decision: "deny",
      deniedPurposes: ["ai-training", "model-training"],
      deniedUses: ["ai-training", "model-training"],
      receipt: { required: true }
    }
  ], {
    fhirBaseUrl: options.fhirBaseUrl
  }, ["Not compliance-in-a-box. Requires clinical, privacy, security, consent, and legal review before production use."]);
}

export function createEnergyInfrastructureProfilePolicy(options: ProfileBaseOptions & {
  devicePaths?: string[];
  ocppEndpoint?: string;
  paid?: PaidOption;
}): IndustryProfilePolicy {
  const rules: AgentAccessRule[] = [
    {
      id: "energy-device-read",
      match: { methods: ["GET"], paths: options.devicePaths ?? ["/devices/**", "/meters/**"] },
      decision: "allow",
      purposes: ["monitoring", "grid-optimization", "maintenance"],
      uses: ["read", "verify", "ai-input"],
      loadPolicy: { maxRps: 1, preferBulkEndpoint: true },
      rateLimit: { requests: 60, window: "1m", burst: 5, respectRetryAfter: true },
      receipt: { required: true }
    },
    {
      id: "energy-device-control-review",
      match: { methods: ["POST", "PUT", "PATCH"], paths: ["/devices/**", "/ocpp/**"] },
      decision: "review",
      purposes: ["maintenance", "demand-response", "grid-optimization"],
      uses: ["control", "write", "api-call"],
      reviewUrl: options.reviewUrl,
      receipt: { required: true, signing: "optional-v0" }
    }
  ];
  if (options.paid) {
    rules.push({
      id: "energy-paid-data-access",
      match: { methods: ["GET"], paths: ["/market-data/**", "/tariffs/**"] },
      decision: "charge",
      purposes: ["monitoring", "grid-optimization", "agentic-commerce"],
      uses: ["read", "ai-input"],
      price: options.paid.price,
      payment: options.paid.payment,
      receipt: { required: true }
    });
  }
  return profile("energy-infrastructure", options, rules, {
    ocppEndpoint: options.ocppEndpoint
  }, ["Does not replace grid-operator approval, safety interlocks, device authentication, or regulatory market participation rules."]);
}

function profile(
  kind: IndustryProfileKind,
  options: ProfileBaseOptions,
  rules: AgentAccessRule[],
  references: Record<string, string | undefined>,
  cautions: string[]
): IndustryProfilePolicy {
  return {
    profileVersion: "0.1",
    profile: kind,
    policy: {
      version: "0.1",
      protocol: "open-agent-access",
      site: {
        name: options.siteName,
        origin: options.origin,
        contact: options.contact,
        terms: options.terms
      },
      defaults: {
        decision: "review",
        respectRobotsTxt: true,
        requireAgentIdentity: true,
        requirePurpose: true,
        requireReceipt: true
      },
      rules,
      receipt: { required: true, signing: "optional-v0" },
      reviewUrl: options.reviewUrl
    },
    references,
    cautions
  };
}
