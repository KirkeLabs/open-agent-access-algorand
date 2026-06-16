# Security

Do not open public issues for vulnerabilities that could expose secrets, bypass
payment, bypass policy enforcement, or cause unpaid service leakage.

Report security issues privately through GitHub private vulnerability reporting
for this repository. If that is unavailable, contact:

```text
security@kirkelabs.com
```

Never commit mnemonics, private keys, or seed phrases. For production, use wallet
integration, KMS, smart-wallet delegation, Liquid Auth, or another secure signing
flow. Mnemonic env loading is for local TestNet development only.

## Maintainer Checklist

- Run `pnpm security:check` and `pnpm audit:prod` before releases.
- Confirm `.env` is not committed.
- Confirm payment examples use TestNet placeholders only.
- Confirm paid routes rate-limit before expensive work.
- Confirm production deployments use shared replay/idempotency storage.
- Confirm facilitators use HTTPS outside local development.
- Confirm CodeQL, Dependency Review, and release gates are green before publish.
