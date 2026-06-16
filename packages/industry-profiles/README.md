# `@kirkelabs/open-agent-access-industry-profiles`

Industry policy profile templates for Open Agent Access.

These helpers create conservative OAA policies for common industries without
pretending to solve the whole domain.

## Install

```sh
npm install @kirkelabs/open-agent-access-industry-profiles @kirkelabs/open-agent-access-core
```

## Profiles

- `createPublishingDataProfilePolicy`
- `createSaasApiProfilePolicy`
- `createSupplyChainProductProfilePolicy`
- `createHealthcareConsentProfilePolicy`
- `createEnergyInfrastructureProfilePolicy`

Each profile returns:

- `profile`
- `policy`
- `references`
- `cautions`

The cautions are part of the API on purpose. OAA should help teams enforce agent
access decisions with receipts; it should not claim to replace legal,
regulatory, safety, clinical, or operational review.
