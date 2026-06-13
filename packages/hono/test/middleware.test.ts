import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import { buildAgentAccessHeaders, readReceiptLedger } from "@kirkelabs/open-agent-access-core";
import { agentAccessMiddleware } from "../src/index.js";

async function makeApp() {
  const dir = await mkdtemp(join(tmpdir(), "oaa-hono-"));
  const policyPath = join(dir, "agent-access.json");
  const ledgerPath = join(dir, "site-receipts.jsonl");
  await writeFile(policyPath, JSON.stringify({
    version: "0.1",
    protocol: "open-agent-access",
    site: { name: "Test", origin: "http://localhost" },
    defaults: { decision: "deny", requireAgentIdentity: true, requirePurpose: true },
    rules: [
      { id: "free", match: { methods: ["GET"], paths: ["/free"] }, decision: "allow", purposes: ["research"], uses: ["read"], rateLimit: { requests: 2, window: "1m" } },
      { id: "deny", match: { methods: ["GET"], paths: ["/deny"] }, decision: "deny", purposes: ["research"], uses: ["read"] },
      { id: "throttle", match: { methods: ["GET"], paths: ["/throttle"] }, decision: "allow", purposes: ["research"], uses: ["read"], rateLimit: { requests: 1, window: "1m" } },
      { id: "paid", match: { methods: ["GET"], paths: ["/paid"] }, decision: "charge", purposes: ["research"], uses: ["ai-input"], price: { amount: "0.005", currency: "USD" }, payment: { type: "x402", settlement: "algorand", network: "testnet" } }
    ]
  }), "utf8");
  const app = new Hono();
  app.use("*", agentAccessMiddleware({
    policyPath,
    receipts: { type: "jsonl", path: ledgerPath },
    algorandX402: { enabled: true, payTo: "TESTADDR", facilitatorUrl: "https://facilitator.goplausible.xyz", network: "testnet" }
  }));
  app.get("/free", (c) => c.json({ ok: true }));
  app.get("/deny", (c) => c.json({ ok: true }));
  app.get("/throttle", (c) => c.json({ ok: true }));
  app.get("/paid", (c) => c.json({ ok: true }));
  const headers = buildAgentAccessHeaders({
    agent: { id: "did:web:agent.example" },
    purpose: "research",
    use: "read",
    traceId: "trace"
  });
  return { app, headers, ledgerPath };
}

describe("Hono middleware", () => {
  it("allows free route and writes receipt", async () => {
    const { app, headers, ledgerPath } = await makeApp();
    const res = await app.request("/free", { headers });
    expect(res.status).toBe(200);
    expect(res.headers.get("AA-Decision")).toBe("allow");
    expect(await readReceiptLedger(ledgerPath)).toHaveLength(1);
  });

  it("denies denied route", async () => {
    const { app, headers } = await makeApp();
    const res = await app.request("/deny", { headers });
    expect(res.status).toBe(403);
    expect(res.headers.get("AA-Decision")).toBe("deny");
  });

  it("throttles with 429", async () => {
    const { app, headers } = await makeApp();
    await app.request("/throttle", { headers });
    const res = await app.request("/throttle", { headers });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("returns 402 for unpaid paid route", async () => {
    const { app, headers } = await makeApp();
    headers.set("AA-Use", "ai-input");
    const res = await app.request("/paid", { headers });
    expect(res.status).toBe(402);
    expect(res.headers.get("AA-Decision")).toBe("charge");
  });

  it("delegates configured paid route when payment header is present", async () => {
    const { app, headers } = await makeApp();
    headers.set("AA-Use", "ai-input");
    headers.set("X-PAYMENT", "test-proof");
    const res = await app.request("/paid", { headers });
    expect(res.status).toBe(200);
  });
});
