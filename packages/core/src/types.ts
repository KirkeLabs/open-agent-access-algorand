export type AgentAccessDecision =
  | "allow"
  | "deny"
  | "charge"
  | "throttle"
  | "review"
  | "redirect_to_api"
  | "human_only";

export interface AgentIdentity {
  id: string;
  name?: string;
  operator?: string;
  principal?: string;
  contact?: string;
}

export interface Budget {
  amount: string;
  currency: string;
}

export interface RateLimitPolicy {
  requests: number;
  window: string;
  burst?: number;
  respectRetryAfter?: boolean;
}

export interface LoadPolicy {
  maxRps?: number;
  preferredWindows?: string[];
  preferBulkEndpoint?: boolean;
  emergencyStop?: string;
}

export interface AttributionPolicy {
  required?: boolean;
  format?: string;
}

export interface RetentionPolicy {
  maxAge?: string;
  allowEmbedding?: boolean;
}

export interface PricePolicy {
  amount: string;
  currency: string;
  unit?: string;
}

export interface PaymentPolicy {
  type: "x402" | string;
  settlement?: "algorand" | string;
  network?: "testnet" | "mainnet" | "localnet" | string;
  scheme?: "exact" | string;
  asset?: string;
  assetId?: string | number;
  assetIdEnv?: string;
  payTo?: string;
  payToEnv?: string;
  facilitatorUrl?: string;
  facilitatorUrlEnv?: string;
}

export interface ReceiptRequirement {
  required?: boolean;
  signing?: string;
}

export interface AgentAccessRule {
  id: string;
  match?: {
    methods?: string[];
    paths?: string[];
  };
  decision: AgentAccessDecision;
  purposes?: string[];
  deniedPurposes?: string[];
  uses?: string[];
  deniedUses?: string[];
  allowedUses?: string[];
  rateLimit?: RateLimitPolicy;
  loadPolicy?: LoadPolicy;
  attribution?: AttributionPolicy;
  retention?: RetentionPolicy;
  training?: boolean;
  summarisation?: boolean;
  summarization?: boolean;
  indexing?: boolean;
  quoteLimit?: {
    maxWords?: number;
    maxCharacters?: number;
  };
  price?: PricePolicy;
  payment?: PaymentPolicy;
  receipt?: ReceiptRequirement;
  redirectTo?: string;
  expiresAt?: string;
  jurisdiction?: string;
  reviewUrl?: string;
}

export interface AgentAccessPolicy {
  version: string;
  protocol: "open-agent-access";
  site: {
    name: string;
    origin: string;
    contact?: string;
    securityContact?: string;
    terms?: string;
  };
  defaults?: {
    decision?: AgentAccessDecision;
    respectRobotsTxt?: boolean;
    requireAgentIdentity?: boolean;
    requirePurpose?: boolean;
    requireReceipt?: boolean;
  };
  rules: AgentAccessRule[];
  paidAccess?: unknown;
  x402?: unknown;
  algorand?: unknown;
  receipt?: ReceiptRequirement;
  expiresAt?: string;
  jurisdiction?: string;
  reviewUrl?: string;
}

export interface AgentAccessRequest {
  url: string;
  method?: string;
  purpose?: string;
  use?: string;
  budget?: Budget;
  maxRate?: string;
  agent?: AgentIdentity;
  now?: Date;
}

export interface DecisionResult {
  decision: AgentAccessDecision;
  rule?: AgentAccessRule;
  reason: string;
  rateLimit?: RateLimitPolicy;
  retryAfter?: number;
}

export interface ReceiptRecord {
  receiptVersion: "0.1";
  receiptType: "agent_access";
  role: "agent" | "site";
  traceId: string;
  receiptId: string;
  timestamp: string;
  method: string;
  url: string;
  origin: string;
  agent?: {
    id?: string;
    name?: string;
    operator?: string;
    principal?: string;
  };
  declared?: {
    purpose?: string;
    use?: string;
    budget?: Budget;
  };
  policy?: {
    url?: string;
    ruleId?: string;
    policyHash?: string;
    decision?: AgentAccessDecision;
  };
  rate?: {
    limit?: number;
    remaining?: number;
    retryAfter?: number;
  };
  payment?: {
    required: boolean;
    type?: string;
    settlement?: string;
    network?: string;
    asset?: string;
    price?: PricePolicy;
    facilitatorUrl?: string;
    transactionId?: string;
    payer?: string;
    payTo?: string;
    settlementSuccess?: boolean;
  };
  response?: {
    status?: number;
    contentType?: string | null;
    contentHash?: string;
  };
  events?: AccessEvent[];
  eventTrailHash?: string;
  signature?: {
    type: "ed25519";
    publicKeyPem?: string;
    value: string;
  };
  previousHash?: string;
  receiptHash?: string;
}

export interface ReceiptLedgerOptions {
  type: "jsonl";
  path: string;
}

export type AccessEventType =
  | "policy_discovered"
  | "mandate_evaluated"
  | "policy_decision"
  | "payment_required"
  | "payment_settled"
  | "fetch_attempted"
  | "fetch_completed"
  | "denied"
  | "throttled"
  | "human_escalated"
  | "rolled_back"
  | "corrected";

export interface AccessEvent {
  eventVersion: "0.1";
  eventId: string;
  traceId: string;
  type: AccessEventType;
  timestamp: string;
  actor?: {
    role: "agent" | "site" | "facilitator" | "human" | "system";
    id?: string;
  };
  subject?: {
    method?: string;
    url?: string;
    tool?: string;
  };
  policy?: {
    url?: string;
    ruleId?: string;
    policyHash?: string;
    decision?: AgentAccessDecision;
  };
  mandate?: {
    mandateId?: string;
    mandateHash?: string;
    decision?: string;
    delegator?: string;
  };
  payment?: {
    required?: boolean;
    type?: string;
    settlement?: string;
    network?: string;
    transactionId?: string;
  };
  evidence?: Record<string, unknown>;
  previousEventHash?: string;
  eventHash?: string;
}
