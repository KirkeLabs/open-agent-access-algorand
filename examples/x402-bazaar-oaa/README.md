# x402 Bazaar + OAA

This example shows the intended interoperability posture:

```text
Bazaar discovers the paid x402 resource.
OAA declares the access policy and receipt requirements.
Algorand x402 settles payment when the decision is charge.
```

Use `@kirkelabs/open-agent-access-x402-bazaar` to attach OAA policy references
to Bazaar discovery metadata without replacing the x402 AVM/Bazaar packages.

See `route.ts` for a minimal static example.

