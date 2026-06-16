import {
  buildAgentAccessHeaders,
  hashCanonicalJson,
  type AgentIdentity,
  type Budget
} from "@kirkelabs/open-agent-access-core";

export interface AgentPassportCredential {
  "@context": string[];
  id?: string;
  type: string[];
  issuer: string | { id: string; name?: string };
  validFrom?: string;
  validUntil?: string;
  credentialSubject: {
    id: string;
    agent: AgentIdentity;
    openAgentAccess: {
      protocolVersion: "0.1";
      purposes?: string[];
      uses?: string[];
      maxBudget?: Budget;
      policyUrl?: string;
      mandateUrl?: string;
      publicKey?: {
        id?: string;
        type?: "Ed25519" | string;
        publicKeyPem?: string;
      };
    };
  };
  proof?: unknown;
}

export interface CreateAgentPassportCredentialInput {
  id?: string;
  issuer: string | { id: string; name?: string };
  agent: AgentIdentity;
  validFrom?: Date | string;
  validUntil?: Date | string;
  purposes?: string[];
  uses?: string[];
  maxBudget?: Budget;
  policyUrl?: string;
  mandateUrl?: string;
  publicKey?: AgentPassportCredential["credentialSubject"]["openAgentAccess"]["publicKey"];
  proof?: unknown;
}

export interface AgentPassportCredentialValidation {
  valid: boolean;
  expired: boolean;
  notYetValid: boolean;
  errors: string[];
  warnings: string[];
}

const OAA_VC_CONTEXT = "https://open-agent-access.org/contexts/agent-passport-v0.1.jsonld";
const VC_V2_CONTEXT = "https://www.w3.org/ns/credentials/v2";

export function createAgentPassportCredential(input: CreateAgentPassportCredentialInput): AgentPassportCredential {
  return {
    "@context": [VC_V2_CONTEXT, OAA_VC_CONTEXT],
    id: input.id,
    type: ["VerifiableCredential", "OpenAgentAccessAgentPassport"],
    issuer: input.issuer,
    validFrom: formatDate(input.validFrom),
    validUntil: formatDate(input.validUntil),
    credentialSubject: {
      id: input.agent.id,
      agent: input.agent,
      openAgentAccess: {
        protocolVersion: "0.1",
        purposes: input.purposes,
        uses: input.uses,
        maxBudget: input.maxBudget,
        policyUrl: input.policyUrl,
        mandateUrl: input.mandateUrl,
        publicKey: input.publicKey
      }
    },
    proof: input.proof
  };
}

export function safeValidateAgentPassportCredential(
  credential: AgentPassportCredential,
  options: { now?: Date; requireProof?: boolean } = {}
): AgentPassportCredentialValidation {
  const now = options.now ?? new Date();
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!credential["@context"]?.includes(VC_V2_CONTEXT)) errors.push("vc_context_missing");
  if (!credential["@context"]?.includes(OAA_VC_CONTEXT)) warnings.push("oaa_context_missing");
  if (!credential.type?.includes("VerifiableCredential")) errors.push("vc_type_missing");
  if (!credential.type?.includes("OpenAgentAccessAgentPassport")) errors.push("agent_passport_type_missing");
  if (!credential.issuer) errors.push("issuer_required");
  if (!credential.credentialSubject?.id) errors.push("credential_subject_id_required");
  if (!credential.credentialSubject?.agent?.id) errors.push("agent_id_required");
  if (credential.credentialSubject?.id && credential.credentialSubject.agent?.id && credential.credentialSubject.id !== credential.credentialSubject.agent.id) {
    errors.push("credential_subject_agent_id_mismatch");
  }
  if (credential.credentialSubject?.openAgentAccess?.protocolVersion !== "0.1") errors.push("unsupported_oaa_protocol_version");
  if (options.requireProof && !credential.proof) errors.push("proof_required");

  const validFrom = credential.validFrom ? Date.parse(credential.validFrom) : undefined;
  const validUntil = credential.validUntil ? Date.parse(credential.validUntil) : undefined;
  if (credential.validFrom && Number.isNaN(validFrom)) errors.push("valid_from_invalid");
  if (credential.validUntil && Number.isNaN(validUntil)) errors.push("valid_until_invalid");
  const notYetValid = typeof validFrom === "number" && validFrom > now.getTime();
  const expired = typeof validUntil === "number" && validUntil <= now.getTime();
  if (!credential.proof) warnings.push("unsigned_credential");

  return {
    valid: errors.length === 0 && !expired && !notYetValid,
    expired,
    notYetValid,
    errors,
    warnings
  };
}

export function validateAgentPassportCredential(
  credential: AgentPassportCredential,
  options: { now?: Date; requireProof?: boolean } = {}
): AgentPassportCredential {
  const result = safeValidateAgentPassportCredential(credential, options);
  if (!result.valid) {
    throw new Error(`Invalid agent passport credential: ${[...result.errors, result.expired ? "expired" : undefined, result.notYetValid ? "not_yet_valid" : undefined].filter(Boolean).join(", ")}`);
  }
  return credential;
}

export function agentIdentityFromCredential(credential: AgentPassportCredential): AgentIdentity {
  validateAgentPassportCredential(credential);
  return credential.credentialSubject.agent;
}

export function buildAgentAccessHeadersFromCredential(
  credential: AgentPassportCredential,
  input: {
    purpose: string;
    use: string;
    budget?: Budget;
    traceId: string;
  }
): Headers {
  const agent = agentIdentityFromCredential(credential);
  return buildAgentAccessHeaders({
    agent,
    purpose: input.purpose,
    use: input.use,
    budget: input.budget,
    traceId: input.traceId
  });
}

export function hashAgentPassportCredential(credential: AgentPassportCredential): string {
  return hashCanonicalJson(credential);
}

function formatDate(value?: Date | string): string | undefined {
  if (!value) return undefined;
  return typeof value === "string" ? value : value.toISOString();
}
