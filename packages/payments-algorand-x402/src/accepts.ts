import type { PricePolicy } from "@kirkelabs/open-agent-access-core";
import { ALGORAND_TESTNET_CAIP2, ExactAvmScheme, type AlgorandX402Accept, type AlgorandX402ServerConfig } from "./types.js";

export function priceToUsdString(price: PricePolicy | undefined): string {
  if (!price) {
    return "$0";
  }
  return price.currency.toUpperCase() === "USD" ? `$${price.amount}` : `${price.amount} ${price.currency.toUpperCase()}`;
}

export function buildAlgorandX402Accepts(config: AlgorandX402ServerConfig & { resource?: string; description?: string }): AlgorandX402Accept[] {
  return [
    {
      scheme: ExactAvmScheme,
      network: config.network ?? ALGORAND_TESTNET_CAIP2,
      payTo: config.payTo,
      asset: config.asset ?? "USDC",
      assetId: config.assetId ?? process.env.USDC_TESTNET_ASA_ID,
      maxAmountRequired: priceToUsdString(config.price),
      resource: config.resource,
      description: config.description
    }
  ];
}
