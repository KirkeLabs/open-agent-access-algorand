# @kirkelabs/open-agent-access-identity

Verifiable agent identity helpers for Open Agent Access.

The core protocol headers declare an agent identity. Enterprise deployments also
need proof that those headers were produced by a trusted key. This package adds
Ed25519 request signing and verification without binding OAA to one identity
provider.

```ts
import {
  createAgentIdentityKeyPair,
  signAgentAccessHeaders,
  verifyAgentAccessHeaders
} from "@kirkelabs/open-agent-access-identity";

const keys = createAgentIdentityKeyPair();
signAgentAccessHeaders(headers, {
  method: "GET",
  url: "https://publisher.example/report",
  privateKeyPem: keys.privateKeyPem,
  keyId: "did:web:agent.example#key-1"
});

const verified = verifyAgentAccessHeaders(headers, {
  method: "GET",
  url: "https://publisher.example/report",
  trustedKeys: [{ keyId: "did:web:agent.example#key-1", publicKeyPem: keys.publicKeyPem }]
});
```

The signed input binds method, URL, trace ID, agent identity, purpose, use, and
budget. It intentionally does not sign secrets or payment proofs.
