# `@kirkelabs/open-agent-access-policy-signing`

Ed25519 policy signing and verification helpers for Open Agent Access.

Use this package to sign `agent-access.json` documents and verify that a policy
hash is bound to a trusted key before an agent relies on it.

## Exports

- `createPolicySigningKeyPair()`
- `signAgentAccessPolicy(policy, input)`
- `verifySignedAgentAccessPolicy(policy, trustedKeys, options)`
- `createPolicyTrustRecord(input)`

Policy signatures harden OAA against policy substitution and stale/malicious
policy mirrors. They do not replace TLS, DNS control, or operational key
management.
