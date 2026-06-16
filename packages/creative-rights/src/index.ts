import {
  hashCanonicalJson,
  type AgentAccessPolicy,
  type AgentAccessRule,
  type PaymentPolicy,
  type PricePolicy,
  type ReceiptRecord
} from "@kirkelabs/open-agent-access-core";

export type CreativeAssetType =
  | "track"
  | "stem"
  | "sample"
  | "loop"
  | "vocal"
  | "remix"
  | "dataset"
  | "image"
  | "text"
  | "other";

export type CreativeRightsClaim =
  | "composition"
  | "lyrics"
  | "sound-recording"
  | "performance"
  | "sample-pack"
  | "dataset"
  | "image"
  | "text"
  | "other";

export type CreativeLicenseDecision = "allow" | "charge" | "review" | "deny";

export interface CreativeParty {
  id?: string;
  name: string;
  role?: string;
  contact?: string;
  wallet?: string;
  share?: number;
  identifiers?: {
    ipi?: string;
    isni?: string;
    prsMember?: string;
    pplMember?: string;
    custom?: Record<string, string>;
  };
}

export interface ExternalRightsReference {
  system: "prs" | "ppl" | "ascap" | "bmi" | "socan" | "soundexchange" | "custom";
  id?: string;
  url?: string;
  note?: string;
}

export interface ProvenanceBinding {
  c2paManifestUrl?: string;
  c2paManifestHash?: string;
  sourceUrl?: string;
  assetHash?: string;
  assetHashAlgorithm?: "sha-256" | string;
}

export interface RegistryBinding {
  algorand?: {
    network: "testnet" | "mainnet" | "localnet" | string;
    transactionId?: string;
    appId?: number | string;
    assetId?: number | string;
    noteHash?: string;
  };
  rsl?: {
    licenseUrl?: string;
    licenseServerUrl?: string;
    termsHash?: string;
  };
  story?: {
    ipAssetId?: string;
    url?: string;
    termsHash?: string;
  };
  custom?: Array<{
    system: string;
    id?: string;
    url?: string;
    termsHash?: string;
  }>;
}

export interface CreativeLicenseOption {
  id: string;
  label?: string;
  decision: CreativeLicenseDecision;
  purposes: string[];
  uses: string[];
  price?: PricePolicy;
  payment?: PaymentPolicy;
  attributionRequired?: boolean;
  retentionMaxAge?: string;
  reviewUrl?: string;
  termsUrl?: string;
}

export interface CreativeAssetPassport {
  version: "0.1";
  protocol: "open-agent-access";
  kind: "creative-asset-passport";
  asset: {
    id: string;
    title: string;
    type: CreativeAssetType;
    hash?: string;
    hashAlgorithm?: "sha-256" | string;
    uri?: string;
    identifiers?: {
      isrc?: string;
      iswc?: string;
      catalogNumber?: string;
      custom?: Record<string, string>;
    };
    createdAt?: string;
  };
  rights: {
    claimant: CreativeParty;
    claims: CreativeRightsClaim[];
    authorshipBasis: "original" | "licensed-sample" | "public-domain" | "mixed" | "unknown";
    ownershipStatement?: string;
    collaborators?: CreativeParty[];
    externalReferences?: ExternalRightsReference[];
  };
  policy: {
    defaultDecision?: "review" | "deny";
    allowedUses?: string[];
    deniedUses?: string[];
    aiTraining?: {
      allowed: boolean;
      requiresReview?: boolean;
      price?: PricePolicy;
    };
    licenseOptions: CreativeLicenseOption[];
  };
  provenance?: ProvenanceBinding;
  registry?: RegistryBinding;
  contact?: string;
  disputeUrl?: string;
  reviewUrl?: string;
  legalNotice?: string;
}

export interface CreativePassportValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateCreativeAssetPassport(passport: CreativeAssetPassport): CreativeAssetPassport {
  const result = safeValidateCreativeAssetPassport(passport);
  if (!result.valid) {
    throw new Error(`Invalid creative asset passport: ${result.errors.join(", ")}`);
  }
  return passport;
}

export function safeValidateCreativeAssetPassport(passport: CreativeAssetPassport): CreativePassportValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (passport.version !== "0.1") errors.push("unsupported_version");
  if (passport.protocol !== "open-agent-access") errors.push("unsupported_protocol");
  if (passport.kind !== "creative-asset-passport") errors.push("unsupported_kind");
  if (!passport.asset?.id) errors.push("asset_id_required");
  if (!passport.asset?.title) errors.push("asset_title_required");
  if (!passport.asset?.type) errors.push("asset_type_required");
  if (!passport.rights?.claimant?.name) errors.push("rights_claimant_required");
  if (!passport.rights?.claims?.length) errors.push("rights_claim_required");
  if (!passport.policy?.licenseOptions?.length) errors.push("license_option_required");

  const collaboratorShares = passport.rights?.collaborators?.map((party) => party.share).filter((share): share is number => typeof share === "number") ?? [];
  if (collaboratorShares.some((share) => share < 0 || share > 100)) errors.push("collaborator_share_out_of_range");
  const totalShares = collaboratorShares.reduce((sum, share) => sum + share, 0);
  if (collaboratorShares.length && Math.round(totalShares * 100) / 100 !== 100) {
    warnings.push("collaborator_shares_do_not_total_100");
  }

  for (const option of passport.policy?.licenseOptions ?? []) {
    if (!option.id) errors.push("license_option_id_required");
    if (!option.decision) errors.push(`license_option_decision_required:${option.id || "unknown"}`);
    if (!option.purposes?.length) errors.push(`license_option_purpose_required:${option.id || "unknown"}`);
    if (!option.uses?.length) errors.push(`license_option_use_required:${option.id || "unknown"}`);
    if (option.decision === "charge" && !option.price) errors.push(`charged_license_price_required:${option.id || "unknown"}`);
  }

  if (passport.rights.authorshipBasis === "unknown") {
    warnings.push("authorship_basis_unknown_requires_human_review");
  }
  if (!passport.asset.hash && !passport.provenance?.assetHash) {
    warnings.push("asset_hash_missing");
  }
  if (!passport.legalNotice) {
    warnings.push("legal_notice_recommended");
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function hashCreativeAssetPassport(passport: CreativeAssetPassport): string {
  return hashCanonicalJson(passport);
}

export function createCreativeAssetAccessPolicy(
  passport: CreativeAssetPassport,
  options: {
    origin: string;
    policyPath?: string;
    termsUrl?: string;
    contact?: string;
    securityContact?: string;
    defaultDecision?: "review" | "deny";
    assetPaths?: string[];
    licensePathFor?: (license: CreativeLicenseOption, passport: CreativeAssetPassport) => string[];
  }
): AgentAccessPolicy {
  validateCreativeAssetPassport(passport);
  const rules: AgentAccessRule[] = [];
  const deniedUses = [...new Set([
    ...(passport.policy.deniedUses ?? []),
    ...(passport.policy.aiTraining?.allowed === false ? ["ai-training", "ai-train", "model-training"] : [])
  ])];
  const deniedPurposes = passport.policy.aiTraining?.allowed === false ? ["ai-training", "ai-train", "model-training"] : undefined;

  for (const license of passport.policy.licenseOptions) {
    const licensePaths = options.licensePathFor?.(license, passport)
      ?? options.assetPaths
      ?? [`/creative-assets/${passport.asset.id}/licenses/${license.id}`];
    rules.push({
      id: `${passport.asset.id}-${license.id}`,
      match: { methods: ["GET", "POST"], paths: licensePaths },
      decision: license.decision === "deny" ? "deny" : license.decision,
      purposes: license.purposes,
      deniedPurposes,
      uses: license.uses,
      deniedUses,
      price: license.price,
      payment: license.payment,
      attribution: { required: license.attributionRequired ?? true, format: "creator-and-source-url" },
      retention: license.retentionMaxAge ? { maxAge: license.retentionMaxAge, allowEmbedding: false } : undefined,
      receipt: { required: true },
      reviewUrl: license.reviewUrl ?? passport.reviewUrl
    });
  }

  return {
    version: "0.1",
    protocol: "open-agent-access",
    site: {
      name: passport.rights.claimant.name,
      origin: options.origin,
      contact: options.contact ?? passport.contact ?? passport.rights.claimant.contact,
      securityContact: options.securityContact,
      terms: options.termsUrl
    },
    defaults: {
      decision: options.defaultDecision ?? passport.policy.defaultDecision ?? "review",
      respectRobotsTxt: true,
      requireAgentIdentity: true,
      requirePurpose: true,
      requireReceipt: true
    },
    rules,
    receipt: { required: true, signing: "optional-v0" },
    jurisdiction: "GB",
    reviewUrl: passport.reviewUrl
  };
}

export function createCreativeReceiptEvidence(passport: CreativeAssetPassport) {
  validateCreativeAssetPassport(passport);
  const passportHash = hashCreativeAssetPassport(passport);
  return {
    creativePassport: {
      version: passport.version,
      kind: passport.kind,
      passportHash,
      assetId: passport.asset.id,
      assetTitle: passport.asset.title,
      assetType: passport.asset.type,
      assetHash: passport.asset.hash ?? passport.provenance?.assetHash,
      rightsClaims: passport.rights.claims,
      claimant: {
        id: passport.rights.claimant.id,
        name: passport.rights.claimant.name,
        wallet: passport.rights.claimant.wallet
      }
    },
    provenance: passport.provenance,
    registry: passport.registry,
    legalBoundary: {
      createsCopyright: false,
      provesFinalOwnership: false,
      purpose: "records declared rights metadata, license terms, payment receipts, and provenance evidence"
    }
  };
}

export function attachCreativeEvidenceToReceipt(receipt: ReceiptRecord, passport: CreativeAssetPassport): ReceiptRecord {
  return {
    ...receipt,
    events: [
      ...(receipt.events ?? []),
      {
        eventVersion: "0.1",
        eventId: `creative_${hashCreativeAssetPassport(passport).slice(0, 16)}`,
        traceId: receipt.traceId,
        type: "policy_decision",
        timestamp: receipt.timestamp,
        actor: { role: receipt.role === "agent" ? "agent" : "site", id: receipt.agent?.id ?? receipt.origin },
        subject: { method: receipt.method, url: receipt.url },
        policy: receipt.policy,
        evidence: createCreativeReceiptEvidence(passport)
      }
    ]
  };
}
