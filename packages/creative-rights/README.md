# `@kirkelabs/open-agent-access-creative-rights`

Creative rights helpers for Open Agent Access.

This package binds creator/asset metadata, licensing terms, provenance
references, and registry references into OAA policies and receipts. It is meant
for use cases such as samples, stems, loops, vocals, datasets, images, articles,
and other creative assets that need machine-readable permission and payment
terms.

It does **not** create copyright, prove final legal ownership, replace PRS/PPL or
other collective-management organisations, or operate as a marketplace.

## Install

```sh
npm install @kirkelabs/open-agent-access-creative-rights @kirkelabs/open-agent-access-core
```

## Example

```ts
import {
  createCreativeAssetAccessPolicy,
  createCreativeReceiptEvidence
} from "@kirkelabs/open-agent-access-creative-rights";

const passport = {
  version: "0.1",
  protocol: "open-agent-access",
  kind: "creative-asset-passport",
  asset: {
    id: "manchester-loop-001",
    title: "Manchester Perc Loop 001",
    type: "loop",
    hash: "sha256:example"
  },
  rights: {
    claimant: { name: "Example Producer", wallet: "ALGOD_ADDRESS" },
    claims: ["sound-recording", "sample-pack"],
    authorshipBasis: "original"
  },
  policy: {
    deniedUses: ["ai-training"],
    aiTraining: { allowed: false },
    licenseOptions: [
      {
        id: "commercial-sample",
        decision: "charge",
        purposes: ["creative-licensing"],
        uses: ["commercial-sample"],
        price: { amount: "25", currency: "GBP", unit: "license" }
      }
    ]
  },
  legalNotice: "This passport records a rights claim and license terms. It is not a copyright registration."
} as const;

const policy = createCreativeAssetAccessPolicy(passport, {
  origin: "https://example-collective.test"
});

const receiptEvidence = createCreativeReceiptEvidence(passport);
```

By default, license rules are emitted on license-specific paths such as
`/creative-assets/manchester-loop-001/licenses/commercial-sample`. This avoids
first-match ambiguity between free, paid, review, and denied licenses.

## Framing

Open Agent Access is the policy, payment, and receipt rail.

- RSL-style terms can be referenced through `registry.rsl`.
- C2PA/content credentials can be referenced through `provenance`.
- Algorand can anchor receipts or settlement references through
  `registry.algorand`.
- Rights societies and marketplaces remain external systems referenced through
  identifiers and URLs.

That keeps OAA useful without pretending to be a rights society, marketplace,
DRM system, or copyright registry.
