# `@kirkelabs/open-agent-access-vc`

W3C Verifiable Credential shaped agent passport helpers for Open Agent Access.

This package makes an OAA agent identity portable across systems that already
understand VC/DID-style credentials. It does not implement a full wallet,
credential exchange protocol, or signature suite.

## Install

```sh
npm install @kirkelabs/open-agent-access-vc @kirkelabs/open-agent-access-core
```

## Example

```ts
import {
  buildAgentAccessHeadersFromCredential,
  createAgentPassportCredential
} from "@kirkelabs/open-agent-access-vc";

const credential = createAgentPassportCredential({
  issuer: "did:web:kirkelabs.com",
  agent: {
    id: "did:web:agent.example#research-agent",
    name: "Research Agent",
    operator: "Example Labs",
    contact: "mailto:agents@example.com"
  },
  purposes: ["research"],
  uses: ["read", "summarize"],
  validUntil: "2026-12-31T23:59:59.000Z"
});

const headers = buildAgentAccessHeadersFromCredential(credential, {
  purpose: "research",
  use: "read",
  traceId: "trace-example"
});
```

Use this package when an agent needs to present a portable passport. Use
`@kirkelabs/open-agent-access-identity` when you need request-header signatures.
