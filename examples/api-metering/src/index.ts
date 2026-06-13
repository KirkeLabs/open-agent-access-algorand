import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { agentAccessMiddleware } from "@kirkelabs/open-agent-access-hono";

const app = new Hono();

app.use("*", agentAccessMiddleware({
  policyPath: new URL("../agent-access.json", import.meta.url).pathname,
  receipts: { type: "jsonl", path: ".oaa/api-metering-site-receipts.jsonl" },
  algorandX402: {
    enabled: process.env.OAA_PAYMENTS_ENABLED === "true",
    payTo: process.env.AVM_ADDRESS,
    facilitatorUrl: process.env.FACILITATOR_URL || "https://facilitator.goplausible.xyz",
    network: "testnet"
  }
}));

app.get("/api/data", (c) => c.json({ ok: true, value: 42 }));

serve({ fetch: app.fetch, port: 4022 });
console.log("API metering example listening on http://localhost:4022");
