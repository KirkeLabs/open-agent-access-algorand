import { access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { readPolicyFile, verifyReceiptChain } from "@kirkelabs/open-agent-access-core";
import { checkAlgorandX402Runtime, validateAlgorandX402Config } from "@kirkelabs/open-agent-access-payments-algorand-x402";

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

export async function doctorCommand(options: Record<string, string | boolean | undefined>) {
  const checks: Check[] = [];
  checks.push(checkNodeVersion());
  checks.push(checkCommandAvailable("rg", "ripgrep available for security scanning"));

  const policyPath = typeof options.policy === "string" ? options.policy : "agent-access.json";
  checks.push(await checkPolicy(policyPath));

  const ledgerPath = typeof options.ledger === "string" ? options.ledger : process.env.OAA_LEDGER_PATH ?? ".oaa/receipts.jsonl";
  checks.push(await checkLedger(ledgerPath));

  checks.push(checkPayments());
  if (options.payments) {
    checks.push(...await checkPaymentDetails());
  }
  checks.push(checkSecretScan());

  if (options.json) {
    console.log(JSON.stringify({ ok: checks.every((check) => check.ok), checks }, null, 2));
    if (!checks.every((check) => check.ok)) process.exitCode = 1;
    return;
  }

  for (const check of checks) {
    console.log(`${check.ok ? "ok" : "fail"} ${check.name}: ${check.detail}`);
  }
  if (!checks.every((check) => check.ok)) {
    process.exitCode = 1;
  }
}

function checkNodeVersion(): Check {
  const major = Number(process.versions.node.split(".")[0]);
  return {
    name: "node",
    ok: major >= 22,
    detail: `Node ${process.versions.node}${major >= 22 ? "" : " is below the recommended 22.x baseline"}`
  };
}

function checkCommandAvailable(command: string, detail: string): Check {
  const result = spawnSync(command, ["--version"], { encoding: "utf8" });
  return {
    name: command,
    ok: result.status === 0,
    detail: result.status === 0 ? detail : `${command} not found`
  };
}

async function checkPolicy(path: string): Promise<Check> {
  try {
    const policy = await readPolicyFile(path);
    return {
      name: "policy",
      ok: true,
      detail: `${path} valid (${policy.rules.length} rules, ${policy.site.origin})`
    };
  } catch (error) {
    return {
      name: "policy",
      ok: false,
      detail: `${path}: ${(error as Error).message}`
    };
  }
}

async function checkLedger(path: string): Promise<Check> {
  try {
    await access(path);
  } catch {
    return {
      name: "ledger",
      ok: true,
      detail: `${path} does not exist yet`
    };
  }
  const result = await verifyReceiptChain(path);
  return {
    name: "ledger",
    ok: result.valid,
    detail: result.valid ? `${path} valid (${result.count} receipts)` : result.errors.join("; ")
  };
}

function checkPayments(): Check {
  const enabled = process.env.OAA_PAYMENTS_ENABLED === "true";
  const validation = validateAlgorandX402Config({
    enabled,
    network: "testnet",
    mnemonicEnv: "AVM_MNEMONIC",
    facilitatorUrl: process.env.FACILITATOR_URL ?? "https://facilitator.goplausible.xyz"
  });
  return {
    name: "payments",
    ok: !enabled || validation.valid,
    detail: enabled
      ? `enabled (${[...validation.errors, ...validation.warnings].join(", ") || "configured"})`
      : "disabled by default"
  };
}

async function checkPaymentDetails(): Promise<Check[]> {
  const checks: Check[] = [];
  const facilitatorUrl = process.env.FACILITATOR_URL ?? "https://facilitator.goplausible.xyz";
  checks.push({
    name: "payments.avm-address",
    ok: Boolean(process.env.AVM_ADDRESS),
    detail: process.env.AVM_ADDRESS ? "AVM_ADDRESS is set" : "AVM_ADDRESS is not set"
  });
  checks.push({
    name: "payments.mnemonic",
    ok: Boolean(process.env.AVM_MNEMONIC),
    detail: process.env.AVM_MNEMONIC ? "AVM_MNEMONIC is set and not printed" : "AVM_MNEMONIC is not set"
  });
  checks.push({
    name: "payments.usdc-asa",
    ok: Boolean(process.env.USDC_TESTNET_ASA_ID),
    detail: process.env.USDC_TESTNET_ASA_ID ? "USDC_TESTNET_ASA_ID is set" : "USDC_TESTNET_ASA_ID is not set"
  });
  checks.push({
    name: "payments.facilitator-url",
    ok: isHttpsOrLocal(facilitatorUrl),
    detail: facilitatorUrl
  });
  try {
    const runtime = await checkAlgorandX402Runtime();
    checks.push({
      name: "payments.x402-packages",
      ok: runtime.ok,
      detail: runtime.ok ? `${runtime.loaded.join(", ")} load` : runtime.missing.join("; ")
    });
  } catch (error) {
    checks.push({ name: "payments.x402-packages", ok: false, detail: (error as Error).message });
  }
  return checks;
}

function isHttpsOrLocal(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function checkSecretScan(): Check {
  const result = spawnSync("tsx", ["scripts/check-secrets.ts"], {
    encoding: "utf8",
    shell: false
  });
  return {
    name: "secret-scan",
    ok: result.status === 0,
    detail: result.status === 0 ? "no obvious committed secrets found" : (result.stderr || result.stdout).trim()
  };
}
