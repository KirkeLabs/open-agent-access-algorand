# Confidence Checklist

Use this to decide whether an integration is ready for real users.

- `pnpm build`, `pnpm test`, `pnpm test:vitest`, `pnpm lint`, `pnpm security:check`, and `pnpm audit:prod` pass.
- `pnpm package:check` passes before release.
- `pnpm pack:dry-run` passes before release.
- CodeQL, Dependency Review, OSSF Scorecard, and CODEOWNERS review are enabled
  for the public repository.
- `oaa doctor` reports a valid policy, valid ledger, and expected payment state.
- `oaa conformance run` passes.
- `oaa policy explain` gives the expected matching rule for representative URLs.
- `oaa receipts inspect` can locate representative receipt IDs or trace IDs.
- Free routes can be checked and fetched without payment setup.
- Paid routes return 402 metadata when payment is disabled.
- Paid routes require explicit budget and payment opt-in.
- Production paid routes use a shared replay store.
- High-cost paid routes require idempotency keys.
- Agent and site receipts reconcile for smoke-test traffic.
- Receipt digests are exported before and after important runs.
- No mnemonics, private keys, seed phrases, or production wallet addresses are committed.
