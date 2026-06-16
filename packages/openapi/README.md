# `@kirkelabs/open-agent-access-openapi`

OpenAPI extension helpers for Open Agent Access.

This package lets API teams declare OAA policy directly on OpenAPI operations
using `x-open-agent-access`, then extract those extensions into a deployable OAA
policy.

## Install

```sh
npm install @kirkelabs/open-agent-access-openapi @kirkelabs/open-agent-access-core
```

## Example

```ts
import {
  addAgentAccessSecurityScheme,
  applyAgentAccessToOpenApiOperation,
  extractAgentAccessPolicyFromOpenApi
} from "@kirkelabs/open-agent-access-openapi";

const documented = addAgentAccessSecurityScheme(
  applyAgentAccessToOpenApiOperation(openapi, {
    path: "/premium/report",
    method: "get",
    extension: {
      decision: "charge",
      purposes: ["research"],
      uses: ["ai-input"],
      price: { amount: "0.005", currency: "USD", unit: "request" }
    }
  })
);

const policy = extractAgentAccessPolicyFromOpenApi(documented, {
  origin: "https://api.example.com"
});
```

This is the easiest adoption path for normal API teams: document the policy once
in OpenAPI, then enforce it through OAA middleware.
