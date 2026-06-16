import { lintAgentAccessPolicy, type AgentAccessPolicy, type PolicyLintFinding } from "@kirkelabs/open-agent-access-core";

export type SecurityProfileName = "local-dev" | "public-demo" | "production" | "enterprise" | "regulated";

export interface SecurityProfileFinding extends PolicyLintFinding {
  profile: SecurityProfileName;
}

export interface SecurityProfileReport {
  profileVersion: "0.1";
  profile: SecurityProfileName;
  ok: boolean;
  findings: SecurityProfileFinding[];
}

export function evaluateSecurityProfile(policy: AgentAccessPolicy, profile: SecurityProfileName): SecurityProfileReport {
  const baseFindings = lintAgentAccessPolicy(policy).findings.map((finding): SecurityProfileFinding => ({ ...finding, profile }));
  const findings = [...baseFindings];
  const strictness = profileStrictness(profile);

  if (strictness >= 1) {
    require(policy.defaults?.respectRobotsTxt === true, findings, profile, "respect_robots_required", "Policy must declare respectRobotsTxt: true");
    require(policy.defaults?.requireAgentIdentity === true, findings, profile, "agent_identity_required", "Policy must require agent identity");
    require(policy.defaults?.requirePurpose === true, findings, profile, "purpose_required", "Policy must require declared purpose");
    require(policy.defaults?.requireReceipt === true || policy.receipt?.required === true, findings, profile, "receipts_required", "Policy must require receipts");
  }

  if (strictness >= 2) {
    require(policy.defaults?.decision !== "allow", findings, profile, "default_allow_forbidden", "Production profiles must not default to allow");
    require(Boolean(policy.expiresAt), findings, profile, "policy_expiry_required", "Production profiles should set policy expiry/review date");
    for (const rule of policy.rules) {
      if (rule.decision === "allow" || rule.decision === "charge") {
        require(Boolean(rule.rateLimit), findings, profile, "rate_limit_required", "Allow and charge rules must declare rate limits", rule.id);
        require(rule.receipt?.required === true || policy.receipt?.required === true, findings, profile, "rule_receipt_required", "Allow and charge rules must require receipts", rule.id);
      }
      if (rule.decision === "charge") {
        require(Boolean(rule.price), findings, profile, "paid_price_required", "Charge rules must declare price", rule.id);
        require(Boolean(rule.payment), findings, profile, "paid_payment_required", "Charge rules must declare payment metadata", rule.id);
      }
    }
  }

  if (strictness >= 3) {
    require(Boolean(policy.site.securityContact), findings, profile, "security_contact_required", "Enterprise profiles require a security contact");
    require(policy.receipt?.signing === "required" || policy.receipt?.signing === "optional-v0", findings, profile, "receipt_signing_required", "Enterprise profiles should declare receipt signing posture");
    require(Boolean(policy.reviewUrl), findings, profile, "review_url_required", "Enterprise profiles require a review/escalation URL");
  }

  if (strictness >= 4) {
    require(policy.defaults?.decision === "deny" || policy.defaults?.decision === "review", findings, profile, "regulated_fail_closed_required", "Regulated profiles must fail closed to deny or review");
    for (const rule of policy.rules) {
      if (rule.decision === "allow" && (rule.uses?.includes("ai-input") || rule.allowedUses?.includes("ai-input"))) {
        findings.push({
          profile,
          severity: "warning",
          code: "regulated_ai_input_review_recommended",
          message: "Regulated profiles should route AI-input access through review unless data classification proves public",
          ruleId: rule.id
        });
      }
    }
  }

  return {
    profileVersion: "0.1",
    profile,
    ok: !findings.some((finding) => finding.severity === "error"),
    findings
  };
}

function profileStrictness(profile: SecurityProfileName): number {
  return {
    "local-dev": 0,
    "public-demo": 1,
    production: 2,
    enterprise: 3,
    regulated: 4
  }[profile];
}

function require(condition: boolean, findings: SecurityProfileFinding[], profile: SecurityProfileName, code: string, message: string, ruleId?: string) {
  if (!condition) findings.push({ profile, severity: "error", code, message, ruleId });
}
