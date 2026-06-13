import { createAgentAccessClient, verifyReceiptChain } from "@kirkelabs/open-agent-access-core";

const client = createAgentAccessClient({
  agent: {
    id: "did:web:agent.example#research-agent",
    name: "Example Research Agent",
    operator: "Example Labs",
    principal: "user:steve@example.com",
    contact: "mailto:agents@example.com"
  },
  ledger: {
    type: "jsonl",
    path: process.env.OAA_LEDGER_PATH ?? ".oaa/receipts.jsonl"
  },
  payments: {
    algorandX402: {
      enabled: process.env.OAA_PAYMENTS_ENABLED === "true",
      network: "testnet",
      mnemonicEnv: "AVM_MNEMONIC"
    }
  }
});

const baseUrl = process.env.OAA_EXAMPLE_ORIGIN ?? "http://localhost:4021";

const free = await client.fetch(`${baseUrl}/free`, {
  purpose: "research",
  use: "read"
});
console.log("free", free.decision.decision, free.response?.status);

const premium = await client.fetch(`${baseUrl}/premium/report`, {
  purpose: "research",
  use: "ai-input",
  budget: { amount: "0.05", currency: "USD" }
});
console.log("premium", premium.decision.decision, premium.response?.status);

console.log(await verifyReceiptChain(process.env.OAA_LEDGER_PATH ?? ".oaa/receipts.jsonl"));
