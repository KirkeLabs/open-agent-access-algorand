import {
  hashPolicy,
  type AgentAccessDecision,
  type AgentAccessPolicy,
  type AgentAccessRule,
  type PaymentPolicy,
  type PricePolicy,
  type RateLimitPolicy
} from "@kirkelabs/open-agent-access-core";

export interface OdrlConstraint {
  leftOperand: string;
  operator: "eq" | "neq" | "lteq" | "gteq" | string;
  rightOperand: string | number | boolean;
}

export interface OdrlDuty {
  action: string;
  target?: string;
  constraint?: OdrlConstraint[];
  amount?: string;
  currency?: string;
  payment?: PaymentPolicy;
}

export interface OdrlRule {
  uid?: string;
  target?: string | string[];
  action: string | string[];
  constraint?: OdrlConstraint[];
  duty?: OdrlDuty[];
}

export interface OdrlPolicy {
  "@context": string | string[];
  uid?: string;
  type: "Set" | "Offer" | "Agreement";
  profile?: string;
  assigner?: string;
  assignee?: string;
  permission?: OdrlRule[];
  prohibition?: OdrlRule[];
  obligation?: OdrlDuty[];
  "oaa:policyHash"?: string;
}

export interface OdrlImportOptions {
  siteName: string;
  origin: string;
  contact?: string;
  terms?: string;
  defaultDecision?: AgentAccessDecision;
}

const ODRL_CONTEXT = "http://www.w3.org/ns/odrl.jsonld";
const OAA_PROFILE = "https://open-agent-access.org/profiles/odrl-v0.1";

export function exportAgentAccessPolicyToOdrl(policy: AgentAccessPolicy): OdrlPolicy {
  const permission: OdrlRule[] = [];
  const prohibition: OdrlRule[] = [];

  for (const rule of policy.rules) {
    const odrlRule = ruleToOdrl(rule);
    if (rule.decision === "deny" || rule.deniedUses?.length || rule.deniedPurposes?.length) {
      prohibition.push(...denialsToOdrl(rule));
    }
    if (rule.decision !== "deny") {
      permission.push(odrlRule);
    }
  }

  return {
    "@context": [ODRL_CONTEXT, "https://open-agent-access.org/contexts/odrl-v0.1.jsonld"],
    uid: `${policy.site.origin.replace(/\/$/, "")}/.well-known/agent-access.json`,
    type: "Offer",
    profile: OAA_PROFILE,
    assigner: policy.site.origin,
    permission,
    prohibition,
    "oaa:policyHash": hashPolicy(policy)
  };
}

export function importOdrlPolicyToAgentAccessPolicy(odrl: OdrlPolicy, options: OdrlImportOptions): AgentAccessPolicy {
  const rules: AgentAccessRule[] = [];
  for (const permission of odrl.permission ?? []) {
    rules.push(odrlRuleToAgentAccessRule(permission, "allow"));
  }
  for (const prohibition of odrl.prohibition ?? []) {
    rules.push(odrlRuleToAgentAccessRule(prohibition, "deny"));
  }
  return {
    version: "0.1",
    protocol: "open-agent-access",
    site: {
      name: options.siteName,
      origin: options.origin,
      contact: options.contact,
      terms: options.terms
    },
    defaults: {
      decision: options.defaultDecision ?? "review",
      respectRobotsTxt: true,
      requireAgentIdentity: true,
      requirePurpose: true,
      requireReceipt: true
    },
    rules,
    receipt: { required: true }
  };
}

export function mapOdrlActionToOaaUse(action: string): string {
  const normalized = action.toLowerCase();
  if (normalized.includes("read") || normalized.includes("display")) return "read";
  if (normalized.includes("summar")) return "summarize";
  if (normalized.includes("index")) return "index";
  if (normalized.includes("train")) return "ai-training";
  if (normalized.includes("derive") || normalized.includes("transform")) return "derivative-use";
  if (normalized.includes("compensate")) return "paid-use";
  return normalized.replace(/^.*:/, "");
}

export function mapOaaUseToOdrlAction(use: string): string {
  switch (use) {
    case "read":
      return "odrl:read";
    case "summarize":
    case "summarise":
      return "oaa:summarize";
    case "index":
      return "oaa:index";
    case "ai-training":
    case "ai-train":
    case "model-training":
      return "oaa:trainAiModel";
    default:
      return `oaa:${use}`;
  }
}

function ruleToOdrl(rule: AgentAccessRule): OdrlRule {
  const duty: OdrlDuty[] = [];
  if (rule.decision === "charge" && rule.price) {
    duty.push(priceToDuty(rule.price, rule.payment));
  }
  if (rule.decision === "review") {
    duty.push({ action: "oaa:obtainHumanReview", target: rule.reviewUrl });
  }
  if (rule.attribution?.required) {
    duty.push({ action: "odrl:attribute" });
  }
  const constraints = constraintsFromRule(rule);
  return {
    uid: rule.id,
    target: rule.match?.paths,
    action: (rule.uses ?? rule.allowedUses ?? ["read"]).map(mapOaaUseToOdrlAction),
    constraint: constraints.length ? constraints : undefined,
    duty: duty.length ? duty : undefined
  };
}

function denialsToOdrl(rule: AgentAccessRule): OdrlRule[] {
  const deniedUses = rule.deniedUses ?? (rule.decision === "deny" ? (rule.uses ?? rule.allowedUses ?? ["read"]) : []);
  const deniedPurposes = rule.deniedPurposes ?? [];
  const target = rule.match?.paths;
  const rules: OdrlRule[] = [];
  if (deniedUses.length) {
    rules.push({
      uid: `${rule.id}-denied-uses`,
      target,
      action: deniedUses.map(mapOaaUseToOdrlAction)
    });
  }
  for (const purpose of deniedPurposes) {
    rules.push({
      uid: `${rule.id}-denied-purpose-${purpose}`,
      target,
      action: "oaa:anyAction",
      constraint: [{ leftOperand: "oaa:purpose", operator: "eq", rightOperand: purpose }]
    });
  }
  return rules;
}

function odrlRuleToAgentAccessRule(rule: OdrlRule, decision: AgentAccessDecision): AgentAccessRule {
  const actions = Array.isArray(rule.action) ? rule.action : [rule.action];
  const targets = Array.isArray(rule.target) ? rule.target : rule.target ? [rule.target] : undefined;
  const priceDuty = rule.duty?.find((duty) => duty.action.includes("compensate"));
  const purposes = rule.constraint
    ?.filter((constraint) => constraint.leftOperand === "oaa:purpose" && constraint.operator === "eq")
    .map((constraint) => String(constraint.rightOperand));
  const rateLimit = odrlConstraintsToRateLimit(rule.constraint);
  return {
    id: rule.uid ?? `odrl-${decision}-${actions.map(mapOdrlActionToOaaUse).join("-")}`,
    match: targets ? { paths: targets } : undefined,
    decision: priceDuty ? "charge" : decision,
    purposes: purposes?.length ? purposes : undefined,
    uses: decision === "deny" ? undefined : actions.map(mapOdrlActionToOaaUse),
    deniedUses: decision === "deny" ? actions.map(mapOdrlActionToOaaUse) : undefined,
    price: priceDuty?.amount && priceDuty.currency ? { amount: priceDuty.amount, currency: priceDuty.currency, unit: "request" } : undefined,
    payment: priceDuty?.payment,
    rateLimit,
    receipt: { required: true }
  };
}

function constraintsFromRule(rule: AgentAccessRule): OdrlConstraint[] {
  const constraints: OdrlConstraint[] = [];
  for (const purpose of rule.purposes ?? []) {
    constraints.push({ leftOperand: "oaa:purpose", operator: "eq", rightOperand: purpose });
  }
  if (rule.rateLimit) {
    constraints.push({ leftOperand: "oaa:rateLimit.requests", operator: "lteq", rightOperand: rule.rateLimit.requests });
    constraints.push({ leftOperand: "oaa:rateLimit.window", operator: "eq", rightOperand: rule.rateLimit.window });
  }
  return constraints;
}

function odrlConstraintsToRateLimit(constraints?: OdrlConstraint[]): RateLimitPolicy | undefined {
  const requests = constraints?.find((constraint) => constraint.leftOperand === "oaa:rateLimit.requests")?.rightOperand;
  const window = constraints?.find((constraint) => constraint.leftOperand === "oaa:rateLimit.window")?.rightOperand;
  if (typeof requests !== "number" || typeof window !== "string") return undefined;
  return { requests, window };
}

function priceToDuty(price: PricePolicy, payment?: PaymentPolicy): OdrlDuty {
  return {
    action: "odrl:compensate",
    amount: price.amount,
    currency: price.currency,
    payment
  };
}
