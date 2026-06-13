# @kirkelabs/open-agent-access-payments-algorand-x402

Algorand x402 payment adapter boundary for Open Agent Access.

Includes:

- client payment adapter
- server payment adapter metadata
- x402 accepts builder
- settlement-header parsing
- deterministic payment fixtures for tests
- budget and opt-in guardrails
- safe TestNet-first config validation

Mnemonic env loading is for local TestNet development only. Production systems
should use wallet integration, KMS, smart-wallet delegation, Liquid Auth, or
another explicit signing flow.
