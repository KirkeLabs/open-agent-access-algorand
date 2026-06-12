# Trust Passport Publisher

This example shows a publisher exposing three machine-readable layers:

- `agent-access.json`: what agents may do with the site.
- `agent-mandates.json`: what delegated authority an approved agent must carry.
- `trust-passport.json`: source-backed claim, authorship, disclosure, and receipt metadata for a canonical page.

Run:

```bash
pnpm --filter @open-agent-access/example-trust-passport-publisher dev
```

Then inspect:

- `http://localhost:4024/.well-known/agent-access.json`
- `http://localhost:4024/.well-known/agent-mandates.json`
- `http://localhost:4024/.well-known/trust-passport.json`
