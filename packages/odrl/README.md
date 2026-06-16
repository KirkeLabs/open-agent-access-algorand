# `@kirkelabs/open-agent-access-odrl`

ODRL-shaped rights policy helpers for Open Agent Access.

This package maps OAA policy rules to ODRL-style permissions, prohibitions, and
duties, and can import a small ODRL-shaped policy into an OAA policy.

It does not provide legal interpretation. Treat imported rights terms as
machine-readable signals that still need contract, rights, and compliance review
where appropriate.

## Install

```sh
npm install @kirkelabs/open-agent-access-odrl @kirkelabs/open-agent-access-core
```

## Example

```ts
import { exportAgentAccessPolicyToOdrl } from "@kirkelabs/open-agent-access-odrl";

const odrl = exportAgentAccessPolicyToOdrl(agentAccessPolicy);
```

Useful for publishers, datasets, creative assets, and APIs that need to express
permissions, prohibitions, attribution duties, review duties, and payment duties
in a rights-policy shape.
