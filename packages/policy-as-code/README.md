# @kirkelabs/open-agent-access-policy-as-code

OPA/Rego and Cedar-style exports for Open Agent Access policies.

The native OAA decision engine remains authoritative for protocol behavior.
Policy-as-code exports help enterprise teams review, mirror, and test OAA policy
posture in existing authorization systems.

```ts
import { exportOpaBundle, exportCedarBundle } from "@kirkelabs/open-agent-access-policy-as-code";

const opa = exportOpaBundle(policy);
const cedar = exportCedarBundle(policy);
```

Exports include enough metadata to bind generated artifacts back to the source
policy hash.
