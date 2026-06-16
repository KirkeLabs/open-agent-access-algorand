# Maintainer Security Checklist

Use this before releases and before accepting payment-path, identity, policy, or
receipt verification changes.

- `pnpm build`, `pnpm test`, `pnpm test:vitest`, `pnpm lint`, `pnpm package:check`, `pnpm pack:dry-run`, `pnpm security:check`, and `pnpm audit:prod` pass.
- No `.env`, mnemonic, private key, seed phrase, or production wallet is present.
- Payment remains opt-in for CLI and SDK examples.
- Budget checks happen before any payment attempt.
- 402 metadata binds method, URL, policy hash, rule ID, and trace ID.
- Paid fulfilment has replay protection and idempotency semantics.
- Raw `X-PAYMENT` headers are not trusted unless an upstream verifier/facilitator
  has already validated settlement and the route explicitly opts into that trust
  boundary.
- Rate limiting happens before expensive site work.
- Receipt verification detects malformed JSON, hash mismatches, and chain breaks.
- Signed agent headers bind the agent key ID, signature timestamp, method, URL,
  purpose, use, and trace ID.
- Transparency inclusion proofs verify for odd-sized Merkle levels.
- Malformed x402 settlement headers fail closed and never imply successful
  settlement.
- Docs clearly separate local TestNet mnemonic loading from production signing.
- CodeQL, Dependency Review, OSSF Scorecard, Dependabot, and CODEOWNERS are
  enabled for the GitHub repository before a public release.
- Release workflow is restricted to `KirkeLabs/open-agent-access-algorand` on
  `main`.
- npm publish keeps provenance enabled.
