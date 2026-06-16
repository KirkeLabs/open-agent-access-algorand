# Contributing

Thanks for helping build Open Agent Access for Algorand.

## Development

```sh
corepack enable
pnpm install
pnpm build
pnpm test
pnpm test:vitest
pnpm lint
pnpm package:check
pnpm pack:dry-run
pnpm security:check
pnpm audit:prod
```

Keep changes small, typed, tested, and documented. Do not add real wallet
addresses, mnemonics, private keys, seed phrases, or production secrets.

Security-sensitive changes to payment, policy enforcement, identity, replay,
transparency, release workflows, or package publishing should include tests and
reference `docs/MAINTAINER_SECURITY_CHECKLIST.md`.

## Labels

Suggested project labels:

- good first issue
- algorand
- x402
- policy-spec
- receipts
- middleware
- agent-client
- security
- docs
