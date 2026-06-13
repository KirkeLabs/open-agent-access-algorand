# @kirkelabs/open-agent-access-evidence

Immutable evidence bundle and append-only storage primitives.

This package does not depend on a cloud vendor SDK. It defines a small
append-only object-store interface that can be backed by S3 Object Lock, GCS
retention policies, Azure immutable blobs, append-only Postgres tables, or a
customer evidence vault.

```ts
import { createEvidenceBundle, putImmutableEvidenceBundle } from "@kirkelabs/open-agent-access-evidence";

const bundle = createEvidenceBundle({ policy, mandateDocument, receipts });
await putImmutableEvidenceBundle(store, bundle);
```

The bundle binds policy hash, mandate hash, receipt hashes, event hashes, and a
bundle hash. Storage writes must be create-only; overwrites are treated as
failures.
