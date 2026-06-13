import { createPolicyTemplate, discoverPolicy, explainPolicyDecision, lintAgentAccessPolicy, policyTemplateNames, readPolicyFile, validateAgentAccessPolicy, type PolicyTemplateName } from "@kirkelabs/open-agent-access-core";
import { exportCedarBundle, exportOpaBundle } from "@kirkelabs/open-agent-access-policy-as-code";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export async function validatePolicyCommand(path: string, json = false) {
  const policy = await readPolicyFile(path);
  const result = { ok: true, version: policy.version, rules: policy.rules.length, origin: policy.site.origin };
  print(result, json);
}

export async function initPolicyCommand(options: Record<string, string | boolean | undefined>) {
  const template = parseTemplate(typeof options.template === "string" ? options.template : "publisher");
  const outputPath = typeof options.output === "string" ? options.output : "agent-access.json";
  const origin = typeof options.origin === "string" ? options.origin : "https://example.com";
  const policy = createPolicyTemplate(template, origin);
  validateAgentAccessPolicy(policy);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(policy, null, 2), { flag: options.force ? "w" : "wx" });
  if (options.json) {
    console.log(JSON.stringify({ outputPath, template, origin, rules: policy.rules.length }, null, 2));
  } else {
    console.log(`created ${outputPath} from ${template} template (${policy.rules.length} rules)`);
  }
}

export async function printPolicyCommand(url: string, json = false) {
  const discovered = await discoverPolicy(url);
  if (json) {
    console.log(JSON.stringify(discovered.policy, null, 2));
    return;
  }
  console.log(`Policy: ${discovered.url}`);
  console.log(`Site: ${discovered.policy.site.name}`);
  console.log(`Rules: ${discovered.policy.rules.length}`);
}

export async function lintPolicyCommand(path: string, json = false) {
  const policy = await readPolicyFile(path);
  const result = lintAgentAccessPolicy(policy);
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.findings.length === 0) {
    console.log("policy lint passed");
  } else {
    console.log(result.ok ? "policy lint passed with findings" : "policy lint failed");
    for (const finding of result.findings) {
      const rule = finding.ruleId ? ` rule=${finding.ruleId}` : "";
      console.log(`${finding.severity} ${finding.code}${rule}: ${finding.message}`);
    }
  }
  if (!result.ok) {
    process.exitCode = 1;
  }
}

export async function explainPolicyCommand(path: string, url: string, options: Record<string, string | boolean | undefined>) {
  const policy = await readPolicyFile(path);
  const explanation = explainPolicyDecision(policy, {
    url,
    method: typeof options.method === "string" ? options.method : "GET",
    purpose: typeof options.purpose === "string" ? options.purpose : undefined,
    use: typeof options.use === "string" ? options.use : undefined,
    agent: { id: "did:web:open-agent-access-cli#explain" }
  });
  if (options.json) {
    console.log(JSON.stringify(explanation, null, 2));
    return;
  }
  console.log(`decision: ${explanation.decision.decision}`);
  console.log(`reason: ${explanation.decision.reason}`);
  if (explanation.decision.rule) console.log(`matchedRule: ${explanation.decision.rule.id}`);
  for (const rule of explanation.rules) {
    console.log(`${rule.matched ? "match" : "skip"} ${rule.ruleId}: ${rule.reasons.join("; ")}`);
  }
}

export async function exportPolicyCommand(path: string, options: Record<string, string | boolean | undefined>) {
  const policy = await readPolicyFile(path);
  const format = typeof options.format === "string" ? options.format : "opa";
  const output = typeof options.output === "string" ? options.output : undefined;
  if (format === "opa") {
    const bundle = exportOpaBundle(policy);
    if (!output || options.json) {
      console.log(JSON.stringify(bundle, null, 2));
      return;
    }
    await mkdir(output, { recursive: true });
    await writeFile(join(output, "data.json"), `${JSON.stringify(bundle.data, null, 2)}\n`, "utf8");
    await writeFile(join(output, "policy.rego"), bundle.rego, "utf8");
    await writeFile(join(output, "input.example.json"), `${JSON.stringify(bundle.inputExample, null, 2)}\n`, "utf8");
    console.log(`OPA bundle written: ${output}`);
    console.log(`policyHash=${bundle.policyHash}`);
    return;
  }
  if (format === "cedar") {
    const bundle = exportCedarBundle(policy);
    if (!output || options.json) {
      console.log(JSON.stringify(bundle, null, 2));
      return;
    }
    await mkdir(output, { recursive: true });
    await writeFile(join(output, "schema.json"), `${JSON.stringify(bundle.schema, null, 2)}\n`, "utf8");
    await writeFile(join(output, "policies.cedar"), `${bundle.policies.join("\n\n")}\n`, "utf8");
    console.log(`Cedar-style bundle written: ${output}`);
    console.log(`policyHash=${bundle.policyHash}`);
    return;
  }
  throw new Error("--format must be opa or cedar");
}

function print(value: unknown, json: boolean) {
  console.log(json ? JSON.stringify(value, null, 2) : format(value as Record<string, unknown>));
}

function format(value: Record<string, unknown>) {
  return Object.entries(value).map(([key, entry]) => `${key}: ${entry}`).join("\n");
}

function parseTemplate(value: string): PolicyTemplateName {
  if ((policyTemplateNames as string[]).includes(value)) {
    return value as PolicyTemplateName;
  }
  throw new Error(`Unknown template "${value}". Available templates: ${policyTemplateNames.join(", ")}`);
}
