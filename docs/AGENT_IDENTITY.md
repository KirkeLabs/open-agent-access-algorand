# Verifiable Agent Identity

Declared agent headers are useful, but enterprise deployments need proof that an
agent identity was asserted by a trusted key.

Open Agent Access supports optional Ed25519 request signing through
`@kirkelabs/open-agent-access-identity`.

## Signed Fields

The signature input binds:

- HTTP method
- URL
- `AA-Agent-ID`
- `AA-Agent-Name`
- `AA-Agent-Operator`
- `AA-Agent-Principal`
- `AA-Purpose`
- `AA-Use`
- `AA-Budget`
- `AA-Trace-ID`
- `AA-Protocol-Version`

The signature does not bind secrets or payment proofs.

## Headers

Signed requests add:

- `AA-Agent-Key-ID`
- `AA-Agent-Signature-Created`
- `AA-Agent-Signature`
- `AA-Agent-Signature-Input-Hash`

Servers that require signed identity should return `401` when the signature is
missing, stale, untrusted, expired, mismatched to the declared agent, or invalid.

## Hono Enforcement

```ts
app.use("*", agentAccessMiddleware({
  policyPath: "./agent-access.json",
  agentIdentity: {
    required: true,
    trustedKeys: [
      {
        keyId: "did:web:agent.example#key-1",
        agentId: "did:web:agent.example",
        publicKeyPem: process.env.AGENT_PUBLIC_KEY_PEM!
      }
    ]
  }
}));
```

## CLI

```sh
pnpm oaa identity keygen
pnpm oaa identity sign-request \
  --private-key .oaa/agent-private.pem \
  --key-id did:web:agent.example#key-1 \
  --agent-id did:web:agent.example \
  --url https://publisher.example/report \
  --purpose research \
  --use read
```

Private keys must never be committed. Development keys should stay in `.oaa/`,
which is ignored by this repo. Production deployments should use a wallet, KMS,
HSM, enterprise identity provider, or delegated signing service.
