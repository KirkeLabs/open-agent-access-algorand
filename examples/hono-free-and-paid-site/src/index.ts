import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { agentAccessMiddleware } from "@kirkelabs/open-agent-access-hono";

const app = new Hono();

app.use(
  "*",
  agentAccessMiddleware({
    policyPath: new URL("../agent-access.json", import.meta.url).pathname,
    policyUrl: "http://localhost:4021/.well-known/agent-access.json",
    receipts: {
      type: "jsonl",
      path: process.env.OAA_SITE_LEDGER_PATH ?? ".oaa/site-receipts.jsonl"
    },
    algorandX402: {
      enabled: process.env.OAA_PAYMENTS_ENABLED === "true",
      payTo: process.env.AVM_ADDRESS,
      facilitatorUrl: process.env.FACILITATOR_URL || "https://facilitator.goplausible.xyz",
      network: "testnet"
    }
  })
);

app.get("/free", (c) => c.json({ ok: true, tier: "free" }));
app.get("/premium/report", (c) => c.json({ ok: true, tier: "premium", report: "Example paid report" }));

serve({ fetch: app.fetch, port: 4021 });
console.log("Open Agent Access example site listening on http://localhost:4021");
