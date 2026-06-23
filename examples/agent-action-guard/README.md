# Agent Action Guard Example

This example shows how a consumer repo can use Open Agent Access to keep
agent-controlled repository actions human-approved and auditable.

Use this pattern when agents may prepare code changes, release notes, docs,
package updates, deployment configs, or contract changes, but must not silently
push, deploy, publish, or mutate production-facing systems.

## Install

```sh
pnpm add -D @kirkelabs/open-agent-access-guard @kirkelabs/open-agent-access-cli
```

Or use the published CLI:

```sh
npx @kirkelabs/open-agent-access init
```

## 1. Install The Local Hook

```sh
oaa install-hooks --repo-path .
```

The hook checks `OAA_APPROVAL_TOKEN` first and then `.oaa/approval-token`.

## 2. Let The Agent Prepare Changes

The agent can inspect, summarize, run tests, and create a diff. It should stop
before pushing or deploying.

## 3. Generate A Review Packet

```sh
oaa diff-packet --repo-path . --action git.push --output oaa-review.md
```

Review the packet for:

- changed files
- diff hash
- high-risk indicators
- env/secret files
- deployment config
- domain/DNS config
- payment config
- contract code
- package/supply-chain changes

## 4. Create A One-Time Approval Token

```sh
oaa approve git.push \
  --repo-path . \
  --note "Human reviewed the bounded diff packet and approved this push." \
  --ttl-minutes 30 \
  --token-file .oaa/approval-token \
  --json
```

The token is bound to the current action, repo, branch, HEAD, and diff hash. If
the agent changes the diff after approval, including untracked file content, the
token fails.

## 5. Push With Guard

```sh
git push
```

The same token cannot be reused.

OAA also writes a create-only used-token marker during redemption, which closes
the common local race where two guard processes try to consume the same token at
nearly the same time.

## 6. Freeze During Incident Review

```sh
oaa freeze on --repo-path . --reason "Incident review"
oaa status --repo-path . --json
```

When freeze is active, push/deploy/publish/env/domain/payment/contract actions
are blocked even with an otherwise-valid approval token.

Disable freeze after review:

```sh
oaa freeze off --repo-path . --reason "Review complete"
```

## 7. Verify The Approval Ledger

```sh
oaa approvals verify --ledger .oaa/approval-ledger.jsonl --json
```

The ledger is append-only and hash chained. Tampering should be detectable.

## 8. Add Remote Enforcement

Generate a GitHub ruleset template:

```sh
oaa github ruleset-template --branch main --checks CI,CodeQL --signed-commits > github-ruleset.json
```

Local hooks are helpful guardrails, but they can be bypassed. Protected
branches, required checks, protected deployment environments, and least-privilege
tokens are required for enterprise enforcement.
