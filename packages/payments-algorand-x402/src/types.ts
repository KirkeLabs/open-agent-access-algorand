import type { Budget, PricePolicy } from "@kirkelabs/open-agent-access-core";

export const ALGORAND_TESTNET_CAIP2 = "algorand:testnet";
export const ExactAvmScheme = "exact";

export interface AlgorandX402ClientConfig {
  enabled?: boolean;
  network?: string;
  mnemonicEnv?: string;
  budget?: Budget;
  price?: PricePolicy;
  facilitatorUrl?: string;
  signer?: unknown;
}

export interface AlgorandX402ServerConfig {
  enabled?: boolean;
  payTo?: string;
  facilitatorUrl?: string;
  network?: string;
  asset?: string;
  assetId?: string | number;
  price?: PricePolicy;
}

export interface AlgorandX402Accept {
  scheme: string;
  network: string;
  payTo?: string;
  asset?: string;
  assetId?: string | number;
  maxAmountRequired?: string;
  resource?: string;
  description?: string;
  mimeType?: string;
  outputSchema?: unknown;
}

export interface SettlementMetadata {
  transactionId?: string;
  payer?: string;
  payTo?: string;
  network?: string;
  asset?: string;
  settlementSuccess?: boolean;
  raw?: unknown;
}
