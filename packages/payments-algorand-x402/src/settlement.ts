import type { SettlementMetadata } from "./types.js";

export function parseAlgorandX402SettlementHeaders(headers: Headers): SettlementMetadata {
  const paymentResponse = headers.get("X-PAYMENT-RESPONSE") ?? headers.get("x-payment-response");
  const txn = headers.get("AA-Payment-Txn") ?? headers.get("X-Algorand-TxID") ?? undefined;
  if (!paymentResponse) {
    return {
      transactionId: txn,
      settlementSuccess: Boolean(txn)
    };
  }
  try {
    const parsed = JSON.parse(paymentResponse) as Record<string, unknown>;
    return {
      transactionId: (parsed.transactionId as string | undefined) ?? (parsed.txId as string | undefined) ?? txn,
      payer: parsed.payer as string | undefined,
      payTo: parsed.payTo as string | undefined,
      network: parsed.network as string | undefined,
      asset: parsed.asset as string | undefined,
      settlementSuccess: true,
      raw: parsed
    };
  } catch {
    return {
      transactionId: txn,
      settlementSuccess: Boolean(txn),
      raw: paymentResponse
    };
  }
}
