import { createAgentAccessClient, parseBudget } from "@kirkelabs/open-agent-access-core";

export async function checkCommand(url: string, options: Record<string, string | boolean | undefined>) {
  const client = createAgentAccessClient({
    agent: defaultAgent(),
    ledger: { type: "jsonl", path: process.env.OAA_LEDGER_PATH ?? ".oaa/receipts.jsonl" },
    payments: {
      algorandX402: {
        enabled: false
      }
    }
  });
  const result = await client.fetch(url, {
    purpose: required(options.purpose, "--purpose"),
    use: required(options.use, "--use"),
    budget: options.budget && typeof options.budget === "string" ? parseBudget(options.budget) : undefined,
    dryRun: true
  });
  printCheck(result, Boolean(options.json));
}

export async function fetchCommand(url: string, options: Record<string, string | boolean | undefined>) {
  const pay = Boolean(options.pay) || process.env.OAA_PAYMENTS_ENABLED === "true";
  const client = createAgentAccessClient({
    agent: defaultAgent(),
    ledger: { type: "jsonl", path: process.env.OAA_LEDGER_PATH ?? ".oaa/receipts.jsonl" },
    payments: {
      algorandX402: {
        enabled: pay,
        network: "testnet",
        mnemonicEnv: "AVM_MNEMONIC"
      }
    }
  });
  const result = await client.fetch(url, {
    purpose: required(options.purpose, "--purpose"),
    use: required(options.use, "--use"),
    budget: options.budget && typeof options.budget === "string" ? parseBudget(options.budget) : undefined
  });
  if (Boolean(options.json)) {
    console.log(JSON.stringify({
      decision: result.decision,
      status: result.response?.status,
      payment: result.payment,
      receiptId: result.receipt?.receiptId
    }, null, 2));
    return;
  }
  console.log(`decision: ${result.decision.decision}`);
  if (result.response) console.log(`status: ${result.response.status}`);
  if (result.decision.decision === "charge" && !pay) console.log("payment required; payment is disabled, so no payment was attempted");
  if (result.receipt) console.log(`receipt: ${result.receipt.receiptId}`);
  if (result.response && result.response.headers.get("content-type")?.includes("application/json")) {
    console.log(await result.response.text());
  }
}

function defaultAgent() {
  return {
    id: process.env.OAA_AGENT_ID ?? "did:web:localhost#open-agent-access-cli",
    name: process.env.OAA_AGENT_NAME ?? "Open Agent Access CLI",
    operator: process.env.OAA_AGENT_OPERATOR ?? "local",
    principal: process.env.OAA_AGENT_PRINCIPAL ?? "local-user",
    contact: process.env.OAA_AGENT_CONTACT ?? "mailto:agents@example.invalid"
  };
}

function required(value: string | boolean | undefined, name: string): string {
  if (!value || typeof value !== "string") {
    throw new Error(`${name} is required`);
  }
  return value;
}

function printCheck(result: Awaited<ReturnType<ReturnType<typeof createAgentAccessClient>["fetch"]>>, json: boolean) {
  const output = {
    decision: result.decision.decision,
    reason: result.decision.reason,
    ruleId: result.decision.rule?.id,
    policyUrl: result.policyUrl,
    payment: result.payment,
    receiptId: result.receipt?.receiptId
  };
  console.log(json ? JSON.stringify(output, null, 2) : Object.entries(output).filter(([, value]) => value !== undefined).map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`).join("\n"));
}
