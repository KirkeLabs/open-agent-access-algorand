import { writeFile } from "node:fs/promises";
import {
  createApprovalToken,
  createGitHubRulesetTemplate,
  generateDiffPacket,
  getGuardStatus,
  guardAction,
  installGitPrePushHook,
  reconcileVercelDeploymentApproval,
  renderDiffPacketMarkdown,
  setFreezeState,
  verifyApprovalLedger
} from "@kirkelabs/open-agent-access-guard";

type Options = Record<string, string | boolean>;

export async function guardCommand(action: string, options: Options) {
  const result = await guardAction({
    action,
    repoPath: stringOption(options, "repo-path") ?? ".",
    approvalToken: stringOption(options, "approval-token") ?? process.env.OAA_APPROVAL_TOKEN,
    actor: stringOption(options, "actor") ?? process.env.USER,
    ledgerPath: stringOption(options, "ledger"),
    freezePath: stringOption(options, "freeze")
  });
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.ok) {
    console.log(`OAA guard allowed ${action}: ${result.reason}`);
  } else {
    console.log(`OAA guard blocked ${action}: ${result.reason}`);
    console.log(`repo: ${result.repo.repoRoot}`);
    console.log(`branch: ${result.repo.branch}`);
    console.log(`HEAD: ${result.repo.head}`);
  }
  if (!result.ok) process.exitCode = 1;
}

export async function approveCommand(action: string, options: Options) {
  const tokenFile = stringOption(options, "token-file");
  const result = await createApprovalToken({
    action,
    repoPath: stringOption(options, "repo-path") ?? ".",
    note: requiredOption(stringOption(options, "note"), "--note"),
    ttlMinutes: numberOption(options, "ttl-minutes") ?? 30,
    actor: stringOption(options, "actor") ?? process.env.USER,
    ledgerPath: stringOption(options, "ledger")
  });
  if (tokenFile) {
    await writeFile(tokenFile, result.token, { mode: 0o600 });
  }
  if (options.json) {
    console.log(JSON.stringify(tokenFile ? { ...result, token: undefined, tokenFile } : result, null, 2));
    return;
  }
  console.log(`OAA approval token created for ${action}`);
  if (tokenFile) {
    console.log(`tokenFile: ${tokenFile}`);
    console.log(`tokenId: ${result.tokenId}`);
  } else {
    console.log(`token: ${result.token}`);
  }
  console.log(`expiresAt: ${result.expiresAt}`);
  console.log("Treat this token like a short-lived secret. It is one-time use.");
}

export async function diffPacketCommand(options: Options) {
  const packet = await generateDiffPacket({
    repoPath: stringOption(options, "repo-path") ?? ".",
    action: stringOption(options, "action") ?? "git.push"
  });
  const output = stringOption(options, "output");
  if (options.json) {
    const text = JSON.stringify(packet, null, 2);
    if (output) await writeFile(output, text);
    else console.log(text);
    return;
  }
  const markdown = renderDiffPacketMarkdown(packet);
  if (output) await writeFile(output, markdown);
  else console.log(markdown);
}

export async function freezeCommand(mode: string, options: Options) {
  if (mode !== "on" && mode !== "off") throw new Error("freeze mode must be on or off");
  const result = await setFreezeState({
    repoPath: stringOption(options, "repo-path") ?? ".",
    active: mode === "on",
    reason: requiredOption(stringOption(options, "reason"), "--reason"),
    actor: stringOption(options, "actor") ?? process.env.USER,
    ledgerPath: stringOption(options, "ledger"),
    freezePath: stringOption(options, "freeze")
  });
  printJsonOrText(options, result, `OAA freeze ${mode}: ${result.reason}`);
}

export async function guardStatusCommand(options: Options) {
  const result = await getGuardStatus({
    repoPath: stringOption(options, "repo-path") ?? ".",
    ledgerPath: stringOption(options, "ledger"),
    freezePath: stringOption(options, "freeze")
  });
  printJsonOrText(options, result, `OAA status: freeze=${result.freeze.active ? "on" : "off"}, ledgerValid=${result.ledger.valid}, records=${result.ledger.records}`);
}

export async function installHooksCommand(options: Options) {
  const result = await installGitPrePushHook({
    repoPath: stringOption(options, "repo-path") ?? ".",
    tokenEnvVar: stringOption(options, "token-env")
  });
  printJsonOrText(options, result, `Installed OAA pre-push hook at ${result.path}`);
}

export async function githubRulesetCommand(options: Options) {
  const checks = stringOption(options, "checks")?.split(",").map((check) => check.trim()).filter(Boolean);
  const result = createGitHubRulesetTemplate({
    branch: stringOption(options, "branch") ?? "main",
    requiredChecks: checks,
    requireSignedCommits: Boolean(options["signed-commits"])
  });
  console.log(JSON.stringify(result, null, 2));
}

export async function vercelReconcileCommand(options: Options) {
  const token = process.env.VERCEL_TOKEN;
  const productionCommit = stringOption(options, "production-commit") ?? stringOption(options, "commit");
  if (!productionCommit) {
    const result = { ok: false, skipped: true, reason: "production_commit_required", hasVercelToken: Boolean(token) };
    printJsonOrText(options, result, "Vercel reconciliation skipped: --production-commit is required");
    if (!options.json) process.exitCode = 1;
    return;
  }
  const result = await reconcileVercelDeploymentApproval({
    repoPath: stringOption(options, "repo-path") ?? ".",
    productionCommit,
    deploymentUrl: stringOption(options, "deployment-url"),
    ledgerPath: stringOption(options, "ledger")
  });
  printJsonOrText(options, { ...result, hasVercelToken: Boolean(token) }, result.reason);
  if (!result.ok) process.exitCode = 1;
}

export async function approvalLedgerVerifyCommand(options: Options) {
  const result = await verifyApprovalLedger(stringOption(options, "ledger") ?? ".oaa/approval-ledger.jsonl");
  printJsonOrText(options, result, `approval ledger ${result.valid ? "valid" : "invalid"} (${result.records.length} records)`);
  if (!result.valid) process.exitCode = 1;
}

function printJsonOrText(options: Options, result: unknown, text: string) {
  if (options.json) console.log(JSON.stringify(result, null, 2));
  else console.log(text);
}

function requiredOption(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function stringOption(options: Options, key: string): string | undefined {
  const value = options[key];
  return typeof value === "string" ? value : undefined;
}

function numberOption(options: Options, key: string): number | undefined {
  const value = stringOption(options, key);
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`--${key} must be a number`);
  return parsed;
}
