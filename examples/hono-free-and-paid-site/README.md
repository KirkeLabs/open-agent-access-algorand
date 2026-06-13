# Hono Free and Paid Site

Run:

```sh
pnpm --filter @kirkelabs/open-agent-access-example-hono-free-and-paid-site dev
```

The server listens on `http://localhost:4021`, exposes
`/.well-known/agent-access.json`, allows `/free`, and returns 402 metadata for
`/premium/report` unless payment is explicitly enabled and a payment header is
present.
