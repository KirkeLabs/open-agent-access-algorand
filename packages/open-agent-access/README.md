# open-agent-access

One-command CLI front door for Open Agent Access.

```sh
npx @kirkelabs/open-agent-access init
```

This package delegates to `@kirkelabs/open-agent-access-cli` and keeps the memorable
installer commands available:

```sh
npx @kirkelabs/open-agent-access init --template hono --protected /essays
npx --package @kirkelabs/open-agent-access agent-passport init --template static-site --protected /essays
npx --package @kirkelabs/open-agent-access oaa policy validate agent-access.json
```

Use this package for onboarding. Use the scoped packages directly for runtime
integrations:

- `@kirkelabs/open-agent-access-core`
- `@kirkelabs/open-agent-access-hono`
- `@kirkelabs/open-agent-access-express`
- `@kirkelabs/open-agent-access-fastify`
- `@kirkelabs/open-agent-access-cloudflare`
- `@kirkelabs/open-agent-access-payments-algorand-x402`
