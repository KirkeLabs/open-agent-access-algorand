# Threat Model

Threats:

- replay attacks
- cross-resource payment proof substitution
- unpaid service leakage
- paid-but-denied failures
- race conditions and duplicate fulfilment
- metadata privacy leakage
- excessive crawler load
- malicious agents lying about purpose
- malicious sites misrepresenting price
- receipt tampering
- secret leakage
- facilitator trust assumptions
- autonomous agents pushing code without review
- autonomous agents deploying production changes without approval
- approval token replay or reuse
- approval drift after the reviewed diff changes
- untracked file content swapped after approval
- concurrent approval token redemption
- local Git hook bypass
- malicious or mistaken approvals for high-risk changes

Mitigations:

- bind receipts to method, URL, policy hash, and trace ID
- bind payment prompts to method, URL, policy hash, rule ID, and trace ID
- enforce budget ceilings before payment
- use replay cache before paid fulfilment
- support idempotency keys for paid fulfilment
- use pessimistic route locks for paid high-cost resources
- rate limit before expensive work
- never log secrets
- keep payment metadata PII-safe
- support dry-run mode
- keep payment disabled by default in CLI
- classify repo/deployment actions by risk before mutation
- require one-time approval tokens for push, deploy, publish, env write, domain
  write, payment config write, and smart contract deployment
- bind approval tokens to repo identity, branch, HEAD, action, expiry, and diff
  hash
- include content digests for changed files, including untracked files, in the
  diff hash
- write create-only used-token markers to prevent concurrent double redemption
- append approval creation/use/rejection records to a tamper-evident JSONL
  ledger
- use freeze mode to block production-facing actions during incidents
- generate GitHub branch ruleset templates for remote enforcement
- reconcile deployment commits against approval ledgers where deployment
  metadata is available

v0.1 receipts are local and tamper-evident, not globally notarized. Signed
receipts and anchoring are roadmap items. The Hono adapter includes an in-memory
replay cache and route lock; production deployments should back these with a
shared datastore when running more than one process or region.

Local OAA Git hooks are guardrails, not absolute enforcement. They can be
bypassed with Git mechanisms or by pushing from another clone. Enterprise
deployment should pair OAA with protected branches, required checks, protected
deployment environments, least-privilege credentials, and deployment-provider
approval controls. OAA records approval and policy compliance; it does not
replace human judgement.
