# Immutable Evidence Storage

Local JSONL ledgers are useful for development and bilateral receipts. Enterprise
deployments need a second step: seal receipt and event evidence into create-only
storage.

`@open-agent-access/evidence` creates evidence bundle manifests that bind:

- policy hash
- mandate document hash
- receipt hashes
- receipt head
- event hashes
- event trail hash
- bundle hash

The package exposes an append-only object-store interface. Production adapters
should map that interface to storage with overwrite prevention, retention, and
legal hold support.

## CLI

```sh
pnpm oaa evidence bundle \
  --policy agent-access.json \
  --mandates agent-mandates.json \
  --ledger .oaa/receipts.jsonl \
  --output oaa-evidence-bundle.json

pnpm oaa evidence verify oaa-evidence-bundle.json
```

## Production Backends

Recommended backing stores:

- S3 Object Lock with compliance retention and versioning.
- GCS bucket retention policies.
- Azure immutable blob storage.
- Append-only Postgres tables with restricted update/delete privileges.
- Internal evidence vaults with WORM controls.

The storage write must be create-only. If an object already exists for a bundle
hash, the write should fail rather than overwrite.

## Operating Model

1. Write operational receipts locally or to a shared ledger.
2. Periodically create an evidence bundle.
3. Write the bundle manifest to immutable storage.
4. Retain the storage version ID, object key, retention mode, and bundle hash.
5. Use the bundle hash in change records, customer assurance, incident response,
   and later proof anchoring.
