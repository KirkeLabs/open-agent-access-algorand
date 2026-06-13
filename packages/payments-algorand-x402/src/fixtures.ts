import type { PricePolicy } from "@kirkelabs/open-agent-access-core";

export interface PaymentRequiredFixtureOptions {
  price?: PricePolicy;
  network?: string;
  asset?: string;
  facilitatorUrl?: string;
  payTo?: string;
}

export function createAlgorandX402PaymentRequiredFixture(options: PaymentRequiredFixtureOptions = {}) {
  return {
    status: 402,
    headers: {
      "content-type": "application/json",
      "AA-Decision": "charge"
    },
    body: {
      error: "payment_required",
      decision: "charge",
      payment: {
        type: "x402",
        settlement: "algorand",
        network: options.network ?? "testnet",
        asset: options.asset ?? "USDC",
        price: options.price ?? { amount: "0.005", currency: "USD", unit: "request" },
        facilitatorUrl: options.facilitatorUrl ?? "https://facilitator.goplausible.xyz",
        payTo: options.payTo ?? "TEST_AVM_ADDRESS"
      }
    }
  };
}

export function createAlgorandX402SettlementFixture(options: {
  transactionId?: string;
  payer?: string;
  payTo?: string;
  network?: string;
  asset?: string;
} = {}) {
  return new Headers({
    "X-PAYMENT-RESPONSE": JSON.stringify({
      transactionId: options.transactionId ?? "TXID_TEST_FIXTURE",
      payer: options.payer ?? "PAYER_TEST_FIXTURE",
      payTo: options.payTo ?? "PAYTO_TEST_FIXTURE",
      network: options.network ?? "testnet",
      asset: options.asset ?? "USDC"
    })
  });
}

export function createMalformedAlgorandX402SettlementFixture() {
  return new Headers({
    "X-PAYMENT-RESPONSE": "not-json"
  });
}
