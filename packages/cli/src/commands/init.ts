import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname } from "node:path";
import type { AgentAccessPolicy } from "@kirkelabs/open-agent-access-core";

type InitTemplate =
  | "static-site"
  | "hono"
  | "express"
  | "fastify"
  | "cloudflare"
  | "agent-client"
  | "algorand-x402";

const initTemplates: InitTemplate[] = [
  "static-site",
  "hono",
  "express",
  "fastify",
  "cloudflare",
  "agent-client",
  "algorand-x402"
];

export async function initCommand(options: Record<string, string | boolean>) {
  const template = parseTemplate(optionString(options, "template") ?? await detectTemplate());
  const origin = optionString(options, "origin") ?? "https://example.com";
  const protectedPath = normalizeProtectedPath(optionString(options, "protected") ?? "/essays");
  const force = Boolean(options.force);
  const policy = buildPolicy({ template, origin, protectedPath });
  const written: string[] = [];

  await mkdir(".oaa", { recursive: true });
  written.push(".oaa/");

  if (template !== "agent-client") {
    await writeJsonFile("agent-access.json", policy, force, written);
    await writeJsonFile(".well-known/agent-access.json", policy, force, written);
  }

  await writeTextFile("docs/agent-access.md", buildIntegrationDoc({ template, origin, protectedPath }), force, written);

  if (template === "algorand-x402") {
    await writeTextFile(".env.example", buildAlgorandEnvExample(), false, written);
  }

  printInitSummary({ template, protectedPath, written });
}

function parseTemplate(input: string): InitTemplate {
  if ((initTemplates as string[]).includes(input)) return input as InitTemplate;
  throw new Error(`Unsupported init template "${input}". Use one of: ${initTemplates.join(", ")}`);
}

async function detectTemplate(): Promise<InitTemplate> {
  const manifest = await readFile("package.json", "utf8").then((text) => JSON.parse(text) as Record<string, unknown>).catch(() => undefined);
  const deps = {
    ...asObject(manifest?.dependencies),
    ...asObject(manifest?.devDependencies)
  };
  if ("hono" in deps) return "hono";
  if ("express" in deps) return "express";
  if ("fastify" in deps) return "fastify";
  if ("wrangler" in deps || "@cloudflare/workers-types" in deps) return "cloudflare";
  return "static-site";
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function buildPolicy(input: { template: InitTemplate; origin: string; protectedPath: string }): AgentAccessPolicy {
  const base: AgentAccessPolicy = {
    version: "0.1",
    protocol: "open-agent-access",
    site: {
      name: siteNameFromOrigin(input.origin),
      origin: input.origin,
      contact: "mailto:agents@example.com",
      securityContact: "mailto:security@example.com",
      terms: `${input.origin}/agent-access`
    },
    defaults: {
      decision: "allow",
      respectRobotsTxt: true,
      requireAgentIdentity: true,
      requirePurpose: true,
      requireReceipt: true
    },
    rules: [
      {
        id: "public-site-open",
        match: { methods: ["GET"], paths: ["/", "/index.html", "/assets/**", "/public/**"] },
        decision: "allow",
        purposes: ["research", "indexing", "accessibility"],
        uses: ["read", "summarize", "quote", "ai-input"],
        deniedUses: ["ai-train"],
        attribution: { required: true, format: "source-url" },
        retention: { maxAge: "30d", allowEmbedding: false },
        rateLimit: { requests: 60, window: "1m", burst: 10, respectRetryAfter: true }
      },
      {
        id: "agent-passport-required",
        match: { methods: ["GET"], paths: [input.protectedPath, `${input.protectedPath}/**`] },
        decision: "review",
        purposes: ["research", "accessibility", "citation"],
        uses: ["read", "summarize", "quote"],
        deniedUses: ["ai-train", "bulk-export", "dataset-build"],
        quoteLimit: { maxWords: 120 },
        attribution: { required: true, format: "source-url" },
        retention: { maxAge: "14d", allowEmbedding: false },
        rateLimit: { requests: 20, window: "1m", burst: 5, respectRetryAfter: true },
        receipt: { required: true, signing: "optional-v0" }
      }
    ],
    expiresAt: "2026-12-31T23:59:59Z",
    reviewUrl: `${input.origin}/agent-access`
  };

  if (input.template === "algorand-x402") {
    base.rules.push({
      id: "premium-x402-algorand",
      match: { methods: ["GET", "POST"], paths: ["/premium/**", "/api/premium/**"] },
      decision: "charge",
      purposes: ["research", "agentic-commerce", "monitoring"],
      uses: ["read", "summarize", "ai-input"],
      deniedUses: ["ai-train"],
      price: { amount: "0.005", currency: "USD", unit: "request" },
      payment: {
        type: "x402",
        settlement: "algorand",
        network: "testnet",
        scheme: "exact",
        asset: "USDC",
        assetIdEnv: "USDC_TESTNET_ASA_ID",
        payToEnv: "AVM_ADDRESS",
        facilitatorUrlEnv: "FACILITATOR_URL"
      },
      rateLimit: { requests: 30, window: "1m", burst: 5, respectRetryAfter: true },
      receipt: { required: true, signing: "optional-v0" }
    });
  }

  return base;
}

async function writeJsonFile(path: string, value: unknown, force: boolean, written: string[]) {
  await writeTextFile(path, `${JSON.stringify(value, null, 2)}\n`, force, written);
}

async function writeTextFile(path: string, value: string, force: boolean, written: string[]) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, { flag: force ? "w" : "wx" })
    .then(() => written.push(path))
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "EEXIST") throw error;
    });
}

function buildIntegrationDoc(input: { template: InitTemplate; origin: string; protectedPath: string }) {
  return `# Open Agent Access Integration

This project publishes an Open Agent Access policy so agents can discover access
rules before reading protected resources.

## Generated Files

- \`agent-access.json\`: local policy file for middleware and tests.
- \`.well-known/agent-access.json\`: policy discovery endpoint for static hosts.
- \`.oaa/\`: default local receipt ledger directory.

## Policy Posture

- Public pages: allow research, indexing, accessibility, summary, and quote use
  with source attribution.
- Protected path: \`${input.protectedPath}\` requires an agent passport and a
  receipt.
- Denied use: AI training, bulk export, and dataset building unless a later
  policy explicitly permits them.

## Agent Passport Headers

\`\`\`sh
curl ${input.origin}${input.protectedPath} \\
  -H "AA-Agent-ID: did:web:agent.example#research-agent" \\
  -H "AA-Agent-Name: Example Research Agent" \\
  -H "AA-Agent-Operator: Example Labs" \\
  -H "AA-Agent-Principal: user:researcher@example.com" \\
  -H "AA-Agent-Contact: mailto:agents@example.com" \\
  -H "AA-Purpose: research" \\
  -H "AA-Use: summarize" \\
  -H "AA-Budget: USD:0.00" \\
  -H "AA-Trace-ID: demo-trace-001" \\
  -H "AA-Respect-Policy: true" \\
  -H "AA-Protocol-Version: 0.1"
\`\`\`

## Install Middleware

${installBlock(input.template)}

## Verify

\`\`\`sh
npx @kirkelabs/open-agent-access policy validate agent-access.json
npx @kirkelabs/open-agent-access check ${input.origin}${input.protectedPath} --purpose research --use summarize
\`\`\`

Static sites can publish the policy and explain the handshake, but production
enforcement belongs at middleware, edge, API gateway, or resource-server level.
`;
}

function installBlock(template: InitTemplate) {
  if (template === "hono" || template === "algorand-x402") {
    return `\`\`\`sh
npm install @kirkelabs/open-agent-access-hono @kirkelabs/open-agent-access-core
\`\`\`

\`\`\`ts
import { agentAccessMiddleware } from "@kirkelabs/open-agent-access-hono";

app.use("*", agentAccessMiddleware({
  policyPath: "./agent-access.json",
  receipts: { type: "jsonl", path: ".oaa/site-receipts.jsonl" }
}));
\`\`\``;
  }
  if (template === "express") {
    return `\`\`\`sh
npm install @kirkelabs/open-agent-access-express @kirkelabs/open-agent-access-core
\`\`\`

\`\`\`ts
import { agentAccessExpressMiddleware } from "@kirkelabs/open-agent-access-express";

app.use(agentAccessExpressMiddleware({
  policyPath: "./agent-access.json",
  receipts: { type: "jsonl", path: ".oaa/site-receipts.jsonl" }
}));
\`\`\``;
  }
  if (template === "fastify") {
    return `\`\`\`sh
npm install @kirkelabs/open-agent-access-fastify @kirkelabs/open-agent-access-core
\`\`\`

\`\`\`ts
import { createAgentAccessFastifyHook } from "@kirkelabs/open-agent-access-fastify";

fastify.addHook("preHandler", createAgentAccessFastifyHook({
  policyPath: "./agent-access.json",
  receipts: { type: "jsonl", path: ".oaa/site-receipts.jsonl" }
}));
\`\`\``;
  }
  if (template === "cloudflare") {
    return `\`\`\`sh
npm install @kirkelabs/open-agent-access-cloudflare @kirkelabs/open-agent-access-core
\`\`\`

\`\`\`ts
import { withAgentAccessCloudflare } from "@kirkelabs/open-agent-access-cloudflare";

export default {
  fetch: withAgentAccessCloudflare({
    policyPath: "./agent-access.json"
  }, async (request, env, ctx) => {
    return new Response("ok");
  })
};
\`\`\``;
  }
  if (template === "agent-client") {
    return `\`\`\`sh
npm install @kirkelabs/open-agent-access-core
\`\`\`

\`\`\`ts
import { createAgentAccessClient } from "@kirkelabs/open-agent-access-core";

const client = createAgentAccessClient({
  agent: {
    id: "did:web:agent.example#research-agent",
    name: "Example Research Agent",
    operator: "Example Labs",
    contact: "mailto:agents@example.com"
  },
  ledger: { type: "jsonl", path: ".oaa/receipts.jsonl" }
});
\`\`\``;
  }
  return `\`\`\`sh
npm install -D open-agent-access
\`\`\`

For static sites, publish \`.well-known/agent-access.json\` and use middleware
later for server-side enforcement.`;
}

function buildAlgorandEnvExample() {
  return `AVM_MNEMONIC=
AVM_ADDRESS=
FACILITATOR_URL=https://facilitator.goplausible.xyz
USDC_TESTNET_ASA_ID=
OAA_PAYMENTS_ENABLED=false
OAA_LEDGER_PATH=.oaa/receipts.jsonl
OAA_SITE_LEDGER_PATH=.oaa/site-receipts.jsonl
`;
}

function printInitSummary(input: { template: InitTemplate; protectedPath: string; written: string[] }) {
  console.log(`Open Agent Access initialized

Template: ${input.template}
Protected path: ${input.protectedPath}
Written:
${input.written.map((path) => `  - ${path}`).join("\n")}

Next:
  npx @kirkelabs/open-agent-access policy validate agent-access.json
  npx @kirkelabs/open-agent-access check http://localhost:3000${input.protectedPath} --purpose research --use summarize
`);
}

function optionString(options: Record<string, string | boolean>, key: string) {
  const value = options[key];
  return typeof value === "string" ? value : undefined;
}

function normalizeProtectedPath(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return normalized.length > 1 && normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

function siteNameFromOrigin(origin: string) {
  try {
    return new URL(origin).hostname.replace(/^www\./, "");
  } catch {
    return basename(origin) || "Local Site";
  }
}
