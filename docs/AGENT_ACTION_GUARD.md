# Agent Action Guard

The Agent Action Guard turns OAA into a reusable approval layer for
agent-controlled repositories, deployments, package publishing, production
configuration, and other consequential actions.

The default rule is simple:

- agents may read, inspect, summarize, generate reports, and pull fast-forward
  updates without approval
- agents may not push, deploy, publish, write environment variables, change
  domains, change payment configuration, or deploy contracts without bounded
  human approval

This is product capability, not a one-off script. The guard package can be used
from the OAA CLI, local Git hooks, CI jobs, deployment reconciliation jobs, or a
custom agent runner.

## Package

```sh
pnpm add -D @kirkelabs/open-agent-access-guard @kirkelabs/open-agent-access-cli
```

The package exports small composable functions:

- `classifyGuardAction()`
- `generateDiffPacket()`
- `createApprovalToken()`
- `guardAction()`
- `verifyApprovalLedger()`
- `setFreezeState()`
- `getGuardStatus()`
- `installGitPrePushHook()`
- `createGitHubRulesetTemplate()`
- `reconcileVercelDeploymentApproval()`

## Action Classes

OAA classifies actions into:

```text
read
summarize
pull
write
push
deploy
publish
env_write
domain_write
payment_config_write
smart_contract_deploy
emergency_override
```

`read`, `summarize`, and `pull` are low-risk by default. All production-facing
write actions require approval by default.

## Approval Lifecycle

1. An agent prepares a change, but does not push or deploy.
2. The agent generates a diff packet.
3. A human reviews the packet and creates a bounded one-time token.
4. The mutating command calls `oaa guard`.
5. The guard verifies repo, branch, HEAD, diff hash, action, expiry, freeze
   status, and one-time token state.
6. The guard appends approval creation/use/rejection records to a hash-chained
   JSONL ledger.

## Diff Packet

```sh
oaa diff-packet --repo-path . --action git.push --output oaa-review.md
oaa diff-packet --repo-path . --action vercel.deploy --json
```

The packet includes:

- repo path and repo identity
- branch
- HEAD
- remote
- changed files
- diff stat
- diff hash
- content digest for changed files, including untracked files
- high-risk file indicators
- suggested risk level
- recommended checks

High-risk indicators include env/secret paths, deployment config, domain/DNS
config, payment config, smart contracts, GitHub workflows, and supply-chain
files.

## Approval Tokens

```sh
oaa approve git.push \
  --repo-path . \
  --note "Steve approved this bounded push after reviewing the diff packet." \
  --ttl-minutes 30 \
  --token-file .oaa/approval-token \
  --json
```

Approval tokens are:

- one-time use
- expiring
- bound to action
- bound to repo identity
- bound to branch
- bound to HEAD
- bound to diff hash
- protected by an atomic one-time-use marker during redemption
- recorded in an append-only approval ledger

Treat approval tokens as short-lived secrets. Do not commit them. The token
secret is hashed in the ledger. For enterprise use, prefer
`--token-file .oaa/approval-token` so the raw token is written with restrictive
file permissions instead of copied through shell logs.

## Guard

```sh
oaa guard git.push --repo-path . --approval-token "$OAA_APPROVAL_TOKEN" --json
```

Successful JSON output is stable enough for agents and automation. Failed output
includes action, action class, repo, branch, HEAD, policy id, freeze state, and
reason.

Common failure reasons:

- `approval_token_required`
- `approval_token_not_found`
- `approval_token_secret_mismatch`
- `approval_token_expired`
- `approval_token_already_used`
- `approval_action_mismatch`
- `approval_repo_mismatch`
- `approval_branch_mismatch`
- `approval_head_mismatch`
- `approval_diff_hash_mismatch`
- `freeze_active`

## Approval Ledger

Default path:

```text
.oaa/approval-ledger.jsonl
```

Each record includes:

- timestamp
- action
- action class
- actor
- note
- repo id/path
- branch
- HEAD
- diff hash
- token id
- previous record hash
- record hash

Verify it:

```sh
oaa approvals verify --ledger .oaa/approval-ledger.jsonl --json
```

The ledger is local and tamper-evident. It is not a remote notary by itself.
Future adapters can anchor approval ledger digests to Algorand.

Successful token redemption also writes a create-only marker under
`.oaa/used-tokens/` so concurrent guard processes cannot redeem the same token
twice before the ledger append is visible.

## Freeze Mode

```sh
oaa freeze on --repo-path . --reason "Incident review"
oaa status --repo-path . --json
oaa freeze off --repo-path . --reason "Review complete"
```

When freeze mode is active, OAA blocks push, deploy, publish, env writes, domain
writes, payment config writes, and contract deployment even if a valid approval
token exists. A separate emergency override path can be added later, but it is
intentionally not silent.

## Git Pre-Push Hook

```sh
oaa install-hooks --repo-path .
```

The hook blocks `git push` unless it can read an approval token from:

- `OAA_APPROVAL_TOKEN`
- `.oaa/approval-token`

The hook calls:

```sh
oaa guard git.push --repo-path "$repo_root" --approval-token "$token" --json
```

The generated hook uses a per-run `mktemp` output file and deletes it on exit;
it does not write guard output to a predictable `/tmp` path.

Local Git hooks are useful guardrails, but they can be bypassed by humans with
Git mechanisms or by pushing from another clone. Enterprise enforcement requires
remote branch protection, required checks, and deployment protection.

## GitHub Ruleset Template

```sh
oaa github ruleset-template --branch main --checks CI,CodeQL --signed-commits
```

The generated JSON recommends:

- no branch deletion
- no force push
- pull request flow
- at least one approving review by default
- stale review dismissal by default
- last-push approval by default
- required status checks
- optional signed commits

Use this as a starting point for GitHub branch rulesets. OAA does not apply live
GitHub settings unless a future authenticated helper is added.

## Vercel Reconciliation

```sh
oaa vercel reconcile \
  --repo-path . \
  --production-commit <sha> \
  --deployment-url https://example.vercel.app \
  --json
```

The first implementation reconciles known production deployment metadata against
the local approval ledger. It does not store Vercel secrets and skips live API
work when `VERCEL_TOKEN` is missing.

## Agent Runner Pattern

Agents should use this sequence:

```text
inspect -> prepare changes -> diff packet -> wait for human approval
-> guard -> mutate only if guard returns ok=true -> append evidence
```

Agents should not:

- set their own approval note
- mint tokens without human review
- push before guard evaluation
- deploy when freeze is active
- reuse old tokens after changing the diff

## Limitations

- Local hooks are guardrails, not absolute enforcement.
- Approval records prove that a token was created and used under a specific repo
  state; they do not prove the human made a good judgement.
- OAA does not replace code review, CI, branch protection, secret scanning,
  deployment protection, security review, or legal review.
- Production deployments should pair OAA with remote branch protection,
  required status checks, protected environments, and least-privilege tokens.
