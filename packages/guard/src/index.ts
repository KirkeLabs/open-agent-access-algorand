import { createHash, randomBytes, randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

export type GuardActionClass =
  | "read"
  | "summarize"
  | "pull"
  | "write"
  | "push"
  | "deploy"
  | "publish"
  | "env_write"
  | "domain_write"
  | "payment_config_write"
  | "smart_contract_deploy"
  | "emergency_override";

export interface RepoSnapshot {
  repoPath: string;
  repoRoot: string;
  repoId: string;
  branch: string;
  head: string;
  remote?: string;
  dirty: boolean;
}

export interface DiffPacket {
  packetVersion: "0.1";
  action: string;
  actionClass: GuardActionClass;
  repo: RepoSnapshot;
  changedFiles: string[];
  diffStat: string;
  diffSummary: string;
  diffHash: string;
  highRiskFiles: Array<{ path: string; reasons: string[] }>;
  riskLevel: "low" | "medium" | "high" | "critical";
  recommendedChecks: string[];
}

export interface ApprovalRecord {
  recordVersion: "0.1";
  recordType: "approval_created" | "approval_used" | "approval_rejected" | "freeze_on" | "freeze_off";
  timestamp: string;
  action: string;
  actionClass: GuardActionClass;
  actor?: string;
  note: string;
  repo: {
    path: string;
    id: string;
    branch: string;
    head: string;
    remote?: string;
  };
  diffHash?: string;
  tokenId?: string;
  tokenHash?: string;
  expiresAt?: string;
  reason?: string;
  previousRecordHash?: string;
  recordHash?: string;
}

export interface ApprovalLedgerVerification {
  valid: boolean;
  records: ApprovalRecord[];
  errors: string[];
  latestHash?: string;
}

export interface ApprovalTokenResult {
  token: string;
  tokenId: string;
  expiresAt: string;
  record: ApprovalRecord;
}

export interface GuardDecision {
  ok: boolean;
  status: "allowed" | "blocked";
  reason: string;
  action: string;
  actionClass: GuardActionClass;
  repo: RepoSnapshot;
  policyId: string;
  approval?: {
    tokenId?: string;
    consumed?: boolean;
  };
  freeze?: FreezeState;
}

export interface FreezeState {
  active: boolean;
  reason?: string;
  actor?: string;
  timestamp?: string;
}

export interface GuardPaths {
  ledgerPath: string;
  freezePath: string;
}

const MUTATING_ACTIONS = new Set<GuardActionClass>([
  "write",
  "push",
  "deploy",
  "publish",
  "env_write",
  "domain_write",
  "payment_config_write",
  "smart_contract_deploy",
  "emergency_override"
]);

const DEFAULT_POLICY_ID = "oaa-agent-action-guard-v0.1";
const TOKEN_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_SECRET_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const ENV_VAR_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function classifyGuardAction(action: string): GuardActionClass {
  const normalized = action.toLowerCase().replace(/[_:]/g, ".");
  if (normalized.includes("emergency")) return "emergency_override";
  if (normalized.includes("contract") && normalized.includes("deploy")) return "smart_contract_deploy";
  if (normalized.includes("payment") && (normalized.includes("write") || normalized.includes("config"))) return "payment_config_write";
  if (normalized.includes("domain") && (normalized.includes("write") || normalized.includes("change"))) return "domain_write";
  if ((normalized.includes("env") || normalized.includes("secret")) && (normalized.includes("write") || normalized.includes("set"))) return "env_write";
  if (normalized.includes("publish") || normalized.includes("npm")) return "publish";
  if (normalized.includes("deploy") || normalized.includes("vercel")) return "deploy";
  if (normalized.includes("push")) return "push";
  if (normalized.includes("write") || normalized.includes("commit") || normalized.includes("config")) return "write";
  if (normalized.includes("pull") || normalized.includes("fetch.fast-forward")) return "pull";
  if (normalized.includes("summar")) return "summarize";
  return "read";
}

export function actionRequiresApproval(action: string | GuardActionClass): boolean {
  const actionClass = typeof action === "string" ? classifyGuardAction(action) : action;
  return MUTATING_ACTIONS.has(actionClass);
}

export async function getRepoSnapshot(repoPath = "."): Promise<RepoSnapshot> {
  const repoRoot = git(repoPath, ["rev-parse", "--show-toplevel"]);
  const branch = git(repoRoot, ["branch", "--show-current"]) || "detached";
  const head = git(repoRoot, ["rev-parse", "HEAD"]);
  const remote = maybeGit(repoRoot, ["config", "--get", "remote.origin.url"]);
  const dirty = Boolean(git(repoRoot, ["status", "--porcelain"]));
  return {
    repoPath: resolve(repoPath),
    repoRoot,
    repoId: hashHex(remote ? `${remote}#${repoRoot}` : repoRoot),
    branch,
    head,
    remote,
    dirty
  };
}

export async function generateDiffPacket(options: { repoPath?: string; action: string }): Promise<DiffPacket> {
  const repo = await getRepoSnapshot(options.repoPath);
  const actionClass = classifyGuardAction(options.action);
  const changedFiles = collectChangedFiles(repo.repoRoot);
  const diffStat = maybeGit(repo.repoRoot, ["diff", "--stat", "HEAD"]) || maybeGit(repo.repoRoot, ["diff", "--stat"]) || "";
  const diffSummary = maybeGit(repo.repoRoot, ["diff", "--summary", "HEAD"]) || "";
  const diffBody = maybeGit(repo.repoRoot, ["diff", "--binary", "HEAD"]) || "";
  const fileDigests = collectFileDigests(repo.repoRoot, changedFiles);
  const diffHash = hashHex(JSON.stringify({
    repoId: repo.repoId,
    branch: repo.branch,
    head: repo.head,
    changedFiles,
    fileDigests,
    diffStat,
    diffSummary,
    diffBody
  }));
  const highRiskFiles = changedFiles
    .map((path) => ({ path, reasons: highRiskReasons(path) }))
    .filter((entry) => entry.reasons.length > 0);
  const riskLevel = inferRiskLevel(actionClass, highRiskFiles);
  return {
    packetVersion: "0.1",
    action: options.action,
    actionClass,
    repo,
    changedFiles,
    diffStat,
    diffSummary,
    diffHash,
    highRiskFiles,
    riskLevel,
    recommendedChecks: recommendedChecks(actionClass, highRiskFiles)
  };
}

export function renderDiffPacketMarkdown(packet: DiffPacket): string {
  const highRisk = packet.highRiskFiles.length
    ? packet.highRiskFiles.map((file) => `- ${file.path}: ${file.reasons.join(", ")}`).join("\n")
    : "- none detected";
  return `# OAA Diff Packet

- Action: ${packet.action}
- Action class: ${packet.actionClass}
- Risk: ${packet.riskLevel}
- Repo: ${packet.repo.repoRoot}
- Branch: ${packet.repo.branch}
- HEAD: ${packet.repo.head}
- Remote: ${packet.repo.remote ?? "none"}
- Diff hash: ${packet.diffHash}

## Changed Files

${packet.changedFiles.length ? packet.changedFiles.map((file) => `- ${file}`).join("\n") : "- none"}

## High-Risk Indicators

${highRisk}

## Diff Stat

\`\`\`text
${packet.diffStat || "No diff stat."}
\`\`\`

## Recommended Checks

${packet.recommendedChecks.map((check) => `- ${check}`).join("\n")}
`;
}

export async function createApprovalToken(options: {
  repoPath?: string;
  action: string;
  note: string;
  ttlMinutes?: number;
  actor?: string;
  ledgerPath?: string;
}): Promise<ApprovalTokenResult> {
  if (!options.note || options.note.trim().length < 12) {
    throw new Error("A human approval note of at least 12 characters is required");
  }
  const packet = await generateDiffPacket({ repoPath: options.repoPath, action: options.action });
  const tokenId = randomUUID();
  const secret = randomBytes(32).toString("base64url");
  const token = `${tokenId}.${secret}`;
  const ttlMinutes = options.ttlMinutes ?? 30;
  if (!Number.isFinite(ttlMinutes) || ttlMinutes <= 0 || ttlMinutes > 1440) {
    throw new Error("Approval token TTL must be greater than 0 and no more than 1440 minutes");
  }
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString();
  const tokenHash = hashToken(token);
  const record: ApprovalRecord = {
    recordVersion: "0.1",
    recordType: "approval_created",
    timestamp: new Date().toISOString(),
    action: options.action,
    actionClass: packet.actionClass,
    actor: options.actor,
    note: options.note,
    repo: recordRepo(packet.repo),
    diffHash: packet.diffHash,
    tokenId,
    tokenHash,
    expiresAt
  };
  const appended = await appendApprovalRecord(defaultLedgerPath(packet.repo.repoRoot, options.ledgerPath), record);
  return { token, tokenId, expiresAt, record: appended };
}

export async function guardAction(options: {
  repoPath?: string;
  action: string;
  approvalToken?: string;
  actor?: string;
  ledgerPath?: string;
  freezePath?: string;
  policyId?: string;
}): Promise<GuardDecision> {
  const packet = await generateDiffPacket({ repoPath: options.repoPath, action: options.action });
  const paths = defaultGuardPaths(packet.repo.repoRoot, options);
  const freeze = await readFreezeState(paths.freezePath);
  if (!actionRequiresApproval(packet.actionClass)) {
    return {
      ok: true,
      status: "allowed",
      reason: "low_risk_action_allowed_without_approval",
      action: options.action,
      actionClass: packet.actionClass,
      repo: packet.repo,
      policyId: options.policyId ?? DEFAULT_POLICY_ID,
      freeze
    };
  }
  if (freeze.active && packet.actionClass !== "emergency_override") {
    return {
      ok: false,
      status: "blocked",
      reason: "freeze_active",
      action: options.action,
      actionClass: packet.actionClass,
      repo: packet.repo,
      policyId: options.policyId ?? DEFAULT_POLICY_ID,
      freeze
    };
  }
  if (!options.approvalToken) {
    return {
      ok: false,
      status: "blocked",
      reason: "approval_token_required",
      action: options.action,
      actionClass: packet.actionClass,
      repo: packet.repo,
      policyId: options.policyId ?? DEFAULT_POLICY_ID,
      freeze
    };
  }
  const redemption = await redeemApprovalToken(paths.ledgerPath, options.approvalToken, packet, options.actor);
  return {
    ok: redemption.ok,
    status: redemption.ok ? "allowed" : "blocked",
    reason: redemption.reason,
    action: options.action,
    actionClass: packet.actionClass,
    repo: packet.repo,
    policyId: options.policyId ?? DEFAULT_POLICY_ID,
    approval: { tokenId: redemption.tokenId, consumed: redemption.ok },
    freeze
  };
}

export async function redeemApprovalToken(
  ledgerPath: string,
  token: string,
  packet: DiffPacket,
  actor?: string
): Promise<{ ok: boolean; reason: string; tokenId?: string }> {
  const tokenParts = token.split(".");
  if (tokenParts.length !== 2 || !TOKEN_ID_PATTERN.test(tokenParts[0]) || !TOKEN_SECRET_PATTERN.test(tokenParts[1])) {
    return { ok: false, reason: "malformed_approval_token" };
  }
  const [tokenId] = tokenParts;
  const ledger = await readApprovalLedger(ledgerPath);
  const created = ledger.find((record) => record.recordType === "approval_created" && record.tokenId === tokenId);
  if (!created) return { ok: false, reason: "approval_token_not_found", tokenId };
  if (created.tokenHash !== hashToken(token)) return { ok: false, reason: "approval_token_secret_mismatch", tokenId };
  if (ledger.some((record) => record.recordType === "approval_used" && record.tokenId === tokenId)) {
    return { ok: false, reason: "approval_token_already_used", tokenId };
  }
  if (created.expiresAt && Date.parse(created.expiresAt) <= Date.now()) {
    await appendApprovalRecord(ledgerPath, rejectionRecord(created, packet, "approval_token_expired", actor));
    return { ok: false, reason: "approval_token_expired", tokenId };
  }
  if (created.action !== packet.action) return { ok: false, reason: "approval_action_mismatch", tokenId };
  if (created.repo.id !== packet.repo.repoId) return { ok: false, reason: "approval_repo_mismatch", tokenId };
  if (created.repo.branch !== packet.repo.branch) return { ok: false, reason: "approval_branch_mismatch", tokenId };
  if (created.repo.head !== packet.repo.head) return { ok: false, reason: "approval_head_mismatch", tokenId };
  if (created.diffHash !== packet.diffHash) return { ok: false, reason: "approval_diff_hash_mismatch", tokenId };
  const claimed = await claimTokenUse(ledgerPath, tokenId, created.tokenHash, packet, actor);
  if (!claimed) return { ok: false, reason: "approval_token_already_used", tokenId };
  await appendApprovalRecord(ledgerPath, {
    recordVersion: "0.1",
    recordType: "approval_used",
    timestamp: new Date().toISOString(),
    action: packet.action,
    actionClass: packet.actionClass,
    actor,
    note: "Approval token redeemed by OAA guard",
    repo: recordRepo(packet.repo),
    diffHash: packet.diffHash,
    tokenId,
    tokenHash: created.tokenHash
  });
  return { ok: true, reason: "approval_token_accepted", tokenId };
}

export async function appendApprovalRecord(ledgerPath: string, record: ApprovalRecord): Promise<ApprovalRecord> {
  await mkdir(dirname(ledgerPath), { recursive: true });
  return withLedgerLock(ledgerPath, async () => {
    const records = await readApprovalLedger(ledgerPath);
    const previousRecordHash = records.at(-1)?.recordHash;
    const next: ApprovalRecord = {
      ...record,
      previousRecordHash,
      recordHash: undefined
    };
    next.recordHash = hashRecord(next);
    const prefix = records.length ? "\n" : "";
    await writeFile(ledgerPath, `${prefix}${JSON.stringify(next)}`, { flag: "a", mode: 0o600 });
    return next;
  });
}

export async function readApprovalLedger(ledgerPath: string): Promise<ApprovalRecord[]> {
  const exists = await pathExists(ledgerPath);
  if (!exists) return [];
  const text = await readFile(ledgerPath, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as ApprovalRecord);
}

export async function verifyApprovalLedger(ledgerPath: string): Promise<ApprovalLedgerVerification> {
  const records = await readApprovalLedger(ledgerPath);
  const errors: string[] = [];
  let previous: string | undefined;
  records.forEach((record, index) => {
    if (record.previousRecordHash !== previous) errors.push(`record ${index} previous hash mismatch`);
    const expected = hashRecord({ ...record, recordHash: undefined });
    if (record.recordHash !== expected) errors.push(`record ${index} hash mismatch`);
    previous = record.recordHash;
  });
  return { valid: errors.length === 0, records, errors, latestHash: previous };
}

export async function setFreezeState(options: {
  repoPath?: string;
  active: boolean;
  reason: string;
  actor?: string;
  ledgerPath?: string;
  freezePath?: string;
}): Promise<FreezeState> {
  if (!options.reason || options.reason.trim().length < 6) throw new Error("freeze reason is required");
  const repo = await getRepoSnapshot(options.repoPath);
  const paths = defaultGuardPaths(repo.repoRoot, options);
  const state: FreezeState = {
    active: options.active,
    reason: options.reason,
    actor: options.actor,
    timestamp: new Date().toISOString()
  };
  await mkdir(dirname(paths.freezePath), { recursive: true });
  await writeFile(paths.freezePath, JSON.stringify(state, null, 2), { mode: 0o600 });
  await appendApprovalRecord(paths.ledgerPath, {
    recordVersion: "0.1",
    recordType: options.active ? "freeze_on" : "freeze_off",
    timestamp: state.timestamp as string,
    action: options.active ? "freeze.on" : "freeze.off",
    actionClass: "emergency_override",
    actor: options.actor,
    note: options.reason,
    repo: recordRepo(repo),
    reason: options.reason
  });
  return state;
}

export async function readFreezeState(freezePath: string): Promise<FreezeState> {
  if (!(await pathExists(freezePath))) return { active: false };
  return JSON.parse(await readFile(freezePath, "utf8")) as FreezeState;
}

export async function getGuardStatus(options: { repoPath?: string; ledgerPath?: string; freezePath?: string }) {
  const repo = await getRepoSnapshot(options.repoPath);
  const paths = defaultGuardPaths(repo.repoRoot, options);
  const freeze = await readFreezeState(paths.freezePath);
  const ledger = await verifyApprovalLedger(paths.ledgerPath);
  return { repo, paths, freeze, ledger: { valid: ledger.valid, records: ledger.records.length, latestHash: ledger.latestHash, errors: ledger.errors } };
}

export async function installGitPrePushHook(options: { repoPath?: string; tokenEnvVar?: string }): Promise<{ path: string }> {
  const repo = await getRepoSnapshot(options.repoPath);
  const gitDir = git(repo.repoRoot, ["rev-parse", "--git-dir"]);
  const hookPath = join(gitDir.startsWith("/") ? gitDir : join(repo.repoRoot, gitDir), "hooks", "pre-push");
  const tokenEnvVar = options.tokenEnvVar ?? "OAA_APPROVAL_TOKEN";
  if (!ENV_VAR_PATTERN.test(tokenEnvVar)) {
    throw new Error("tokenEnvVar must be a valid shell environment variable name");
  }
const script = `#!/bin/sh
set -eu
repo_root="$(git rev-parse --show-toplevel)"
guard_output="$(mktemp "\${TMPDIR:-/tmp}/oaa-guard-pre-push.XXXXXX")"
trap 'rm -f "$guard_output"' EXIT HUP INT TERM
token="\${${tokenEnvVar}:-}"
if [ -z "$token" ] && [ -f "$repo_root/.oaa/approval-token" ]; then
  token="$(cat "$repo_root/.oaa/approval-token")"
fi
if [ -z "$token" ]; then
  echo "OAA guard blocked git push: approval token required." >&2
  echo "Run: oaa diff-packet --repo-path . --action git.push" >&2
  echo "Then: oaa approve git.push --repo-path . --note '<human approval note>'" >&2
  exit 1
fi
if ! oaa guard git.push --repo-path "$repo_root" --approval-token "$token" --json >"$guard_output"; then
  echo "OAA guard blocked git push:" >&2
  cat "$guard_output" >&2 || true
  exit 1
fi
`;
  await mkdir(dirname(hookPath), { recursive: true });
  await writeFile(hookPath, script);
  await chmod(hookPath, 0o755);
  return { path: hookPath };
}

export function createGitHubRulesetTemplate(options: {
  branch?: string;
  requiredChecks?: string[];
  requireSignedCommits?: boolean;
} = {}) {
  const branch = options.branch ?? "main";
  return {
    name: `OAA protected ${branch}`,
    target: "branch",
    enforcement: "active",
    conditions: {
      ref_name: {
        include: [`refs/heads/${branch}`],
        exclude: []
      }
    },
    rules: [
      { type: "deletion" },
      { type: "non_fast_forward" },
      { type: "pull_request", parameters: { required_approving_review_count: 1, dismiss_stale_reviews_on_push: true, require_code_owner_review: false, require_last_push_approval: true } },
      { type: "required_status_checks", parameters: { strict_required_status_checks_policy: true, required_status_checks: (options.requiredChecks ?? ["CI", "CodeQL"]).map((context) => ({ context })) } },
      ...(options.requireSignedCommits ? [{ type: "required_signatures" }] : [])
    ]
  };
}

export async function reconcileVercelDeploymentApproval(options: {
  repoPath?: string;
  productionCommit: string;
  deploymentUrl?: string;
  ledgerPath?: string;
}) {
  const repo = await getRepoSnapshot(options.repoPath);
  const ledgerPath = defaultLedgerPath(repo.repoRoot, options.ledgerPath);
  const records = await readApprovalLedger(ledgerPath);
  const matchingApproval = records.find((record) =>
    record.recordType === "approval_used"
    && record.repo.id === repo.repoId
    && record.repo.head === options.productionCommit
    && record.actionClass === "deploy"
  );
  return {
    ok: Boolean(matchingApproval),
    productionCommit: options.productionCommit,
    deploymentUrl: options.deploymentUrl,
    repo,
    matchingApproval,
    reason: matchingApproval ? "deployment_has_matching_oaa_approval" : "deployment_missing_oaa_approval"
  };
}

export function defaultGuardPaths(repoRoot: string, options: { ledgerPath?: string; freezePath?: string } = {}): GuardPaths {
  return {
    ledgerPath: defaultLedgerPath(repoRoot, options.ledgerPath),
    freezePath: options.freezePath ? resolve(repoRoot, options.freezePath) : join(repoRoot, ".oaa", "freeze.json")
  };
}

function defaultLedgerPath(repoRoot: string, ledgerPath?: string) {
  return ledgerPath ? resolve(repoRoot, ledgerPath) : join(repoRoot, ".oaa", "approval-ledger.jsonl");
}

function rejectionRecord(created: ApprovalRecord, packet: DiffPacket, reason: string, actor?: string): ApprovalRecord {
  return {
    recordVersion: "0.1",
    recordType: "approval_rejected",
    timestamp: new Date().toISOString(),
    action: packet.action,
    actionClass: packet.actionClass,
    actor,
    note: `Approval rejected: ${reason}`,
    repo: recordRepo(packet.repo),
    diffHash: packet.diffHash,
    tokenId: created.tokenId,
    tokenHash: created.tokenHash,
    reason
  };
}

function collectChangedFiles(repoRoot: string): string[] {
  const names = new Set<string>();
  for (const args of [
    ["diff", "--name-only", "HEAD"],
    ["diff", "--name-only", "--cached"],
    ["ls-files", "--others", "--exclude-standard"]
  ]) {
    for (const line of maybeGit(repoRoot, args)?.split(/\r?\n/) ?? []) {
      const path = line.trim();
      if (path && !isOaaGuardRuntimeFile(path)) names.add(path);
    }
  }
  return [...names].sort();
}

function collectFileDigests(repoRoot: string, changedFiles: string[]): string[] {
  return changedFiles.map((path) => {
    const contentHash = maybeGit(repoRoot, ["hash-object", "--no-filters", "--", path]);
    const status = maybeGit(repoRoot, ["status", "--porcelain=v1", "--", path]) ?? "missing";
    return `${path}:${status}:${contentHash ?? "missing"}`;
  });
}

function isOaaGuardRuntimeFile(path: string): boolean {
  return path === ".oaa/approval-ledger.jsonl"
    || path === ".oaa/approval-token"
    || path === ".oaa/freeze.json"
    || path.startsWith(".oaa/used-tokens/");
}

async function claimTokenUse(
  ledgerPath: string,
  tokenId: string,
  tokenHash: string | undefined,
  packet: DiffPacket,
  actor?: string
): Promise<boolean> {
  const markerPath = join(dirname(ledgerPath), "used-tokens", `${tokenId}.json`);
  await mkdir(dirname(markerPath), { recursive: true });
  const marker = {
    tokenId,
    tokenHash,
    action: packet.action,
    actionClass: packet.actionClass,
    repo: recordRepo(packet.repo),
    diffHash: packet.diffHash,
    actor,
    timestamp: new Date().toISOString()
  };
  try {
    await writeFile(markerPath, JSON.stringify(marker, null, 2), { flag: "wx", mode: 0o600 });
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "EEXIST") return false;
    throw error;
  }
}

function highRiskReasons(path: string): string[] {
  const lower = path.toLowerCase();
  const reasons: string[] = [];
  if (/(^|\/)\.env|secret|private[-_]?key|mnemonic|seed/.test(lower)) reasons.push("secret_or_env_material");
  if (/vercel|netlify|render|fly\.toml|dockerfile|compose|k8s|terraform|pulumi|helm|deploy|workflow|github\/workflows/.test(lower)) reasons.push("deployment_or_ci_config");
  if (/domain|dns|cloudflare|route53/.test(lower)) reasons.push("domain_or_dns_config");
  if (/payment|x402|wallet|payto|facilitator|stripe|checkout/.test(lower)) reasons.push("payment_config");
  if (/contract|smart[-_]?contract|teal|pyteal|algopy|solidity|\.sol$/.test(lower)) reasons.push("smart_contract");
  if (/package\.json|pnpm-lock|package-lock|yarn.lock/.test(lower)) reasons.push("package_or_supply_chain");
  return reasons;
}

function inferRiskLevel(actionClass: GuardActionClass, highRiskFiles: Array<{ reasons: string[] }>): DiffPacket["riskLevel"] {
  if (actionClass === "emergency_override" || highRiskFiles.some((file) => file.reasons.includes("secret_or_env_material") || file.reasons.includes("smart_contract"))) return "critical";
  if (["push", "deploy", "publish", "env_write", "domain_write", "payment_config_write"].includes(actionClass) || highRiskFiles.length > 0) return "high";
  if (actionClass === "write") return "medium";
  return "low";
}

function recommendedChecks(actionClass: GuardActionClass, highRiskFiles: Array<{ reasons: string[] }>): string[] {
  const checks = ["Review changed files and diff stat", "Confirm action scope and target branch"];
  if (actionRequiresApproval(actionClass)) checks.push("Require explicit human approval note", "Verify CI/build/test status before mutation");
  if (highRiskFiles.some((file) => file.reasons.includes("secret_or_env_material"))) checks.push("Verify no secrets, mnemonics, or private keys are committed");
  if (highRiskFiles.some((file) => file.reasons.includes("payment_config"))) checks.push("Verify payment addresses, facilitators, budgets, and settlement network");
  if (highRiskFiles.some((file) => file.reasons.includes("deployment_or_ci_config"))) checks.push("Verify deployment target, environment, and required checks");
  if (highRiskFiles.some((file) => file.reasons.includes("smart_contract"))) checks.push("Require contract review and deployment dry-run");
  return checks;
}

function recordRepo(repo: RepoSnapshot): ApprovalRecord["repo"] {
  return { path: repo.repoRoot, id: repo.repoId, branch: repo.branch, head: repo.head, remote: repo.remote };
}

function hashRecord(record: ApprovalRecord): string {
  return hashHex(stableJson({ ...record, recordHash: undefined }));
}

function hashToken(token: string): string {
  return hashHex(`oaa-approval-token:${token}`);
}

function hashHex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function maybeGit(cwd: string, args: string[]): string | undefined {
  try {
    return git(cwd, args);
  } catch {
    return undefined;
  }
}

async function pathExists(path: string) {
  return stat(path).then(() => true).catch(() => false);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

async function withLedgerLock<T>(ledgerPath: string, fn: () => Promise<T>): Promise<T> {
  const lockPath = `${ledgerPath}.lock`;
  const startedAt = Date.now();
  while (true) {
    try {
      await mkdir(lockPath, { mode: 0o700 });
      break;
    } catch (error) {
      if (!isNodeError(error) || error.code !== "EEXIST") throw error;
      if (Date.now() - startedAt > 5_000) {
        throw new Error(`Timed out waiting for OAA approval ledger lock: ${lockPath}`);
      }
      await delay(25);
    }
  }
  try {
    return await fn();
  } finally {
    await rm(lockPath, { recursive: true, force: true });
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
