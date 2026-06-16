# `@kirkelabs/open-agent-access-replay`

Shared replay, idempotency, and resource-binding helpers for Open Agent Access.

Use this package across framework adapters to bind payment proofs and fulfilment
attempts to method, URL, policy hash, rule ID, trace ID, and idempotency key.

## Exports

- `createMemoryReplayStore(options)`
- `buildResourceBindingHash(input)`
- `buildReplayKey(input)`
- `checkAndRememberReplay(store, key, ttlMs)`
- `requireIdempotencyKey(input)`

Production deployments should inject a shared datastore-backed replay store.
