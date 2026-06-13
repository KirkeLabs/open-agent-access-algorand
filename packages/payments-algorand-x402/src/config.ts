import { budgetAllowsPrice } from "@kirkelabs/open-agent-access-core";
import type { AlgorandX402ClientConfig, AlgorandX402ServerConfig } from "./types.js";

export function validateAlgorandX402Config(config: AlgorandX402ClientConfig | AlgorandX402ServerConfig) {
  const errors: string[] = [];
  if (!config.enabled) {
    return { valid: true, enabled: false, warnings: ["payment_disabled"], errors };
  }
  const warnings: string[] = [];
  const network = config.network ?? "testnet";
  if (!["testnet", "mainnet", "localnet", "algorand:testnet", "algorand:mainnet", "algorand:localnet"].includes(network)) {
    errors.push("unsupported_algorand_network");
  }
  if (config.facilitatorUrl) {
    try {
      const url = new URL(config.facilitatorUrl);
      const isLocal = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
      if (url.protocol !== "https:" && !isLocal) {
        errors.push("facilitator_url_must_use_https");
      }
    } catch {
      errors.push("invalid_facilitator_url");
    }
  }
  if ("mnemonicEnv" in config && config.enabled) {
    const envName = config.mnemonicEnv ?? "AVM_MNEMONIC";
    if (!/^[A-Z0-9_]+$/.test(envName)) {
      errors.push("mnemonic_env_name_must_be_uppercase_identifier");
    }
    if (!process.env[envName] && !config.signer) {
      warnings.push(`missing_${envName}`);
    }
  }
  if ("payTo" in config && config.enabled && !config.payTo) {
    warnings.push("missing_pay_to");
  }
  return { valid: errors.length === 0 && warnings.length === 0, enabled: true, warnings, errors };
}

export function assertPaymentMayProceed(config: AlgorandX402ClientConfig) {
  if (!config.enabled) {
    throw new Error("Algorand x402 payment refused: payments are disabled");
  }
  if (!budgetAllowsPrice(config.budget, config.price)) {
    throw new Error("Algorand x402 payment refused: price exceeds declared budget");
  }
  const mnemonicEnv = config.mnemonicEnv ?? "AVM_MNEMONIC";
  if (!config.signer && !process.env[mnemonicEnv]) {
    throw new Error(`Algorand x402 payment refused: ${mnemonicEnv} is not set`);
  }
}

export async function checkAlgorandX402Runtime() {
  const loaded: string[] = [];
  const missing: string[] = [];
  for (const packageName of ["@x402/core", "@x402/fetch", "@x402/avm"]) {
    try {
      await import(packageName);
      loaded.push(packageName);
    } catch (error) {
      missing.push(`${packageName}: ${(error as Error).message}`);
    }
  }
  return {
    ok: missing.length === 0,
    loaded,
    missing
  };
}
