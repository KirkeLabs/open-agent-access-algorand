# @kirkelabs/open-agent-access-enterprise

Enterprise readiness helpers for Open Agent Access.

This package turns policy, mandate, receipt, and event evidence into reviewable
control output:

- enterprise control reports
- access risk scoring
- privacy-safe audit redaction
- OpenTelemetry-style span export
- CEF/SIEM event export
- evidence bundle digests

```ts
import { createEnterpriseControlReport } from "@kirkelabs/open-agent-access-enterprise";

const report = createEnterpriseControlReport({ policy, mandateDocument, receipts });
```

The package is intentionally dependency-light and does not call external systems.
Production teams can forward the exported objects to their SIEM, data lake, GRC,
or observability pipeline of choice.
