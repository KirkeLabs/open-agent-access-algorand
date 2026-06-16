# `@kirkelabs/open-agent-access-algorand-anchor`

Algorand anchoring payload and verification helpers for Open Agent Access.

This package builds safe anchor payloads and note strings for policy hashes,
receipt hashes, transparency roots, and evidence bundles. It does not submit
transactions by itself; production submission should use a wallet, KMS, smart
wallet, or audited signer flow.

## Exports

- `createAlgorandAnchorPayload(input)`
- `createPolicyAnchorPayload(policy, network, metadata)`
- `createReceiptAnchorPayload(receipt, network, metadata)`
- `createTransparencyRootAnchorPayload(log, network, metadata)`
- `createAlgorandAnchorRecord(payload, settlement)`
- `buildAlgorandAnchorNote(payload)`
- `verifyAlgorandAnchorRecord(record, expected)`

Only hashes and minimal metadata should be anchored. Do not put private receipt
data, PII, mnemonics, or raw creative/health/customer data on-chain.
