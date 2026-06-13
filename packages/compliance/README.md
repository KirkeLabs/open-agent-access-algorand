# @kirkelabs/open-agent-access-compliance

Compliance control mappings for Open Agent Access.

This package does not provide legal advice or certify compliance. It maps OAA
technical controls to common enterprise evidence themes so security, legal,
governance, and platform teams can review deployment posture.

```ts
import { getComplianceMapping } from "@kirkelabs/open-agent-access-compliance";

const mapping = getComplianceMapping("nist-ai-rmf");
```

Supported mapping keys:

- `nist-ai-rmf`
- `eu-ai-act`
- `soc2`
- `iso27001`
- `nis2`
