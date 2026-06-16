# `@kirkelabs/open-agent-access-transparency`

Merkle transparency log helpers for Open Agent Access.

Use this package to publish append-only digest logs for receipts, policies,
evidence bundles, or transparency roots. The package provides deterministic
Merkle roots and inclusion proofs, without running a hosted log service.

## Exports

- `createTransparencyLog(entries)`
- `receiptToTransparencyEntry(receipt)`
- `createInclusionProof(log, index)`
- `verifyInclusionProof(proof)`
- `merkleRoot(hashes)`

Pair this with `@kirkelabs/open-agent-access-algorand-anchor` when you want to
anchor a log root on Algorand.
