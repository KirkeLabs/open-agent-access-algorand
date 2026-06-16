# Ecosystem Adapters

Open Agent Access is the policy, payment, and receipt rail. It should integrate
with adjacent systems without becoming those systems.

```text
OAA = policy decision + budget/rate terms + payment requirement + receipt
RSL = external licensing signal
C2PA = external content provenance signal
Algorand = settlement and receipt anchoring
Creative Passport = use-case layer for rights-aware assets
Marketplaces and collectives = distribution and administration partners
```

## What OAA Should Integrate

### RSL-style licensing

OAA should import or reference machine-readable licensing terms and map them to
OAA decisions:

- `allow`
- `deny`
- `charge`
- `review`

OAA should keep the execution layer: preflight, headers, payment metadata, and
receipts.

### C2PA/content credentials

OAA should bind content provenance references to receipts. It should not replace
C2PA or try to parse every media format in the core runtime.

Useful receipt fields:

- content credential manifest URL
- manifest hash
- source asset hash
- OAA receipt ID
- OAA policy hash

### Algorand anchoring

Algorand should be used for settlement and optional receipt anchoring. The chain
should store hashes, transaction references, and settlement evidence, not private
creative files or unnecessary personal data.

### Creative passports

Creative passports are use-case metadata for samples, stems, tracks, images,
datasets, and similar assets. They should declare:

- claimant
- claimed rights
- collaborators/splits
- allowed uses
- denied uses
- AI-training posture
- license options
- provenance references
- registry references
- dispute and review paths

They do not create copyright, replace written contracts, or prove final legal
ownership.

## What OAA Should Not Become

OAA should not become:

- a marketplace
- a copyright registry
- a PRS/PPL/ASCAP/BMI replacement
- a DRM system
- a legal ownership oracle
- a full royalty accounting platform

Those systems can be referenced by OAA receipts and policies, but they remain
separate layers.

## Package

The first adapter package is:

```sh
npm install @kirkelabs/open-agent-access-creative-rights
```

It provides:

- `validateCreativeAssetPassport`
- `safeValidateCreativeAssetPassport`
- `hashCreativeAssetPassport`
- `createCreativeAssetAccessPolicy`
- `createCreativeReceiptEvidence`
- `attachCreativeEvidenceToReceipt`

By default the package emits license-specific OAA paths, for example
`/creative-assets/:assetId/licenses/:licenseId`. This keeps free, paid, review,
and denied use cases deterministic under OAA's first-match rule engine.

See [`examples/creative-passport`](../examples/creative-passport/README.md).
