import { checkAlgorandX402Runtime, validateAlgorandX402Config } from "./config.js";

export interface AlgorandX402TestnetCheckOptions {
  live?: boolean;
  env?: NodeJS.ProcessEnv;
  fetch?: typeof fetch;
  facilitatorUrl?: string;
}

export interface AlgorandX402TestnetCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface AlgorandX402TestnetCheckResult {
  ok: boolean;
  live: boolean;
  checks: AlgorandX402TestnetCheck[];
}

export async function runAlgorandX402TestnetCheck(options: AlgorandX402TestnetCheckOptions = {}): Promise<AlgorandX402TestnetCheckResult> {
  const env = options.env ?? process.env;
  const facilitatorUrl = options.facilitatorUrl ?? env.FACILITATOR_URL ?? "https://facilitator.goplausible.xyz";
  const checks: AlgorandX402TestnetCheck[] = [];
  const validation = validateAlgorandX402Config({
    enabled: true,
    network: "testnet",
    mnemonicEnv: "AVM_MNEMONIC",
    facilitatorUrl
  });
  checks.push({
    name: "config",
    ok: validation.errors.length === 0,
    detail: [...validation.errors, ...validation.warnings].join(", ") || "valid"
  });
  checks.push({
    name: "AVM_MNEMONIC",
    ok: Boolean(env.AVM_MNEMONIC),
    detail: env.AVM_MNEMONIC ? "set and not printed" : "missing"
  });
  checks.push({
    name: "AVM_ADDRESS",
    ok: Boolean(env.AVM_ADDRESS),
    detail: env.AVM_ADDRESS ? "set" : "missing"
  });
  checks.push({
    name: "USDC_TESTNET_ASA_ID",
    ok: Boolean(env.USDC_TESTNET_ASA_ID),
    detail: env.USDC_TESTNET_ASA_ID ? "set" : "missing"
  });
  checks.push({
    name: "FACILITATOR_URL",
    ok: isHttpsOrLocal(facilitatorUrl),
    detail: facilitatorUrl
  });
  const runtime = await checkAlgorandX402Runtime();
  checks.push({
    name: "x402-runtime-packages",
    ok: runtime.ok,
    detail: runtime.ok ? runtime.loaded.join(", ") : runtime.missing.join("; ")
  });

  const liveAllowed = options.live && env.OAA_LIVE_X402_TESTS === "true";
  if (options.live && !liveAllowed) {
    checks.push({
      name: "live-gate",
      ok: false,
      detail: "set OAA_LIVE_X402_TESTS=true to run live network checks"
    });
  }
  if (liveAllowed) {
    checks.push(await facilitatorReachabilityCheck(facilitatorUrl, options.fetch ?? fetch));
  }

  return {
    ok: checks.every((check) => check.ok),
    live: Boolean(liveAllowed),
    checks
  };
}

async function facilitatorReachabilityCheck(facilitatorUrl: string, fetchImpl: typeof fetch): Promise<AlgorandX402TestnetCheck> {
  try {
    const response = await fetchImpl(facilitatorUrl, { method: "HEAD" });
    return {
      name: "facilitator-reachable",
      ok: response.status < 500,
      detail: `HTTP ${response.status}`
    };
  } catch (error) {
    return {
      name: "facilitator-reachable",
      ok: false,
      detail: (error as Error).message
    };
  }
}

function isHttpsOrLocal(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}
