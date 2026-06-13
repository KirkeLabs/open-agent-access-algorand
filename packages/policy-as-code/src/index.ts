import { hashPolicy, type AgentAccessPolicy, type AgentAccessRule } from "@kirkelabs/open-agent-access-core";

export interface OpaPolicyBundle {
  format: "opa";
  policyHash: string;
  data: unknown;
  rego: string;
  inputExample: unknown;
}

export interface CedarPolicyBundle {
  format: "cedar";
  policyHash: string;
  schema: unknown;
  policies: string[];
}

export function exportOpaBundle(policy: AgentAccessPolicy): OpaPolicyBundle {
  const policyHash = hashPolicy(policy);
  const data = {
    oaa: {
      policyHash,
      defaultDecision: policy.defaults?.decision ?? "deny",
      rules: policy.rules.map((rule) => ({
        id: rule.id,
        decision: rule.decision,
        methods: rule.match?.methods?.map((method) => method.toUpperCase()) ?? ["*"],
        paths: rule.match?.paths ?? ["**"],
        purposes: rule.purposes ?? ["*"],
        uses: rule.uses ?? rule.allowedUses ?? ["*"],
        deniedPurposes: rule.deniedPurposes ?? [],
        deniedUses: rule.deniedUses ?? [],
        price: rule.price,
        payment: rule.payment
      }))
    }
  };
  return {
    format: "opa",
    policyHash,
    data,
    rego: buildRegoModule(),
    inputExample: {
      method: "GET",
      path: "/docs/page",
      purpose: "research",
      use: "read",
      agent: { id: "did:web:agent.example" }
    }
  };
}

export function exportCedarBundle(policy: AgentAccessPolicy): CedarPolicyBundle {
  const policyHash = hashPolicy(policy);
  return {
    format: "cedar",
    policyHash,
    schema: {
      namespace: "OpenAgentAccess",
      entityTypes: {
        Agent: { shape: { type: "Record", attributes: { id: { type: "String", required: true } } } },
        Resource: { shape: { type: "Record", attributes: { path: { type: "String", required: true } } } }
      },
      actions: Object.fromEntries([...new Set(policy.rules.flatMap((rule) => rule.match?.methods ?? ["GET"]))].map((method) => [method.toUpperCase(), {}]))
    },
    policies: policy.rules.map((rule) => cedarPolicyForRule(rule, policyHash))
  };
}

function buildRegoModule(): string {
  return `package open_agent_access

default decision := data.oaa.defaultDecision

decision := rule.decision if {
  rule := matching_rules[_]
}

matching_rules[rule] if {
  rule := data.oaa.rules[_]
  method_matches(rule)
  path_matches(rule)
  purpose_matches(rule)
  use_matches(rule)
  not denied_purpose(rule)
  not denied_use(rule)
}

method_matches(rule) if {
  rule.methods[_] == "*"
} else if {
  rule.methods[_] == upper(input.method)
}

path_matches(rule) if {
  rule.paths[_] == "**"
} else if {
  glob.match(rule.paths[_], ["/"], input.path)
}

purpose_matches(rule) if {
  rule.purposes[_] == "*"
} else if {
  rule.purposes[_] == input.purpose
}

use_matches(rule) if {
  rule.uses[_] == "*"
} else if {
  rule.uses[_] == input.use
}

denied_purpose(rule) if {
  rule.deniedPurposes[_] == input.purpose
}

denied_use(rule) if {
  rule.deniedUses[_] == input.use
}
`;
}

function cedarPolicyForRule(rule: AgentAccessRule, policyHash: string): string {
  const effect = rule.decision === "allow" || rule.decision === "charge" ? "permit" : "forbid";
  const actions = (rule.match?.methods ?? ["GET"]).map((method) => `OpenAgentAccess::Action::"${escapeCedar(method.toUpperCase())}"`).join(", ");
  const paths = (rule.match?.paths ?? ["**"]).map((path) => `context.path like "${escapeCedar(path.replace(/\*\*/g, "*"))}"`).join(" || ");
  const purposes = (rule.purposes ?? ["*"]).map((purpose) => `context.purpose == "${escapeCedar(purpose)}"`).join(" || ");
  const uses = (rule.uses ?? rule.allowedUses ?? ["*"]).map((use) => `context.use == "${escapeCedar(use)}"`).join(" || ");
  const deniedUses = (rule.deniedUses ?? []).map((use) => `context.use != "${escapeCedar(use)}"`).join(" && ");
  const guards = [
    `context.policyHash == "${policyHash}"`,
    `context.ruleId == "${escapeCedar(rule.id)}"`,
    `(${paths})`,
    `(${purposes})`,
    `(${uses})`,
    deniedUses ? `(${deniedUses})` : undefined
  ].filter(Boolean).join(" && ");
  return `${effect}(
  principal,
  action in [${actions}],
  resource
) when {
  ${guards}
};`;
}

function escapeCedar(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}
