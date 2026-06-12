# @open-agent-access/conformance

Conformance fixtures and runner for Open Agent Access v0.1.

```ts
import { runConformanceSuite } from "@open-agent-access/conformance";

const result = await runConformanceSuite();
```

The suite checks policy validation, path matching, decisions, headers, receipt
hash chaining, mandate fail-closed behavior, event trail hash chaining, and the
Algorand x402 profile fixtures.
