import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { hashCanonicalJson, validateAgentAccessPolicy } from "@open-agent-access/core";
import { evaluateMandate, validateMandateDocument } from "@open-agent-access/mandates";

const root = new URL("..", import.meta.url);
const port = Number(process.env.PORT ?? 4024);

const policy = validateAgentAccessPolicy(JSON.parse(await readFile(new URL("agent-access.json", root), "utf8")));
const mandates = validateMandateDocument(JSON.parse(await readFile(new URL("agent-mandates.json", root), "utf8")));
const trustPassport = JSON.parse(await readFile(new URL("trust-passport.json", root), "utf8"));

createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://localhost:${port}`);
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("AA-Protocol-Version", "0.1");
  response.setHeader("AA-Policy-Hash", hashCanonicalJson(policy));

  if (url.pathname === "/.well-known/agent-access.json") {
    response.end(JSON.stringify(policy, null, 2));
    return;
  }

  if (url.pathname === "/.well-known/agent-mandates.json") {
    response.end(JSON.stringify(mandates, null, 2));
    return;
  }

  if (url.pathname === "/.well-known/trust-passport.json") {
    response.end(JSON.stringify(trustPassport, null, 2));
    return;
  }

  if (url.pathname === "/briefs/ai-carry-papers") {
    const mandate = evaluateMandate(mandates, {
      agentId: request.headers["aa-agent-id"]?.toString() ?? "anonymous",
      principal: request.headers["aa-agent-principal"]?.toString(),
      operator: request.headers["aa-agent-operator"]?.toString(),
      purpose: request.headers["aa-purpose"]?.toString() ?? "research",
      use: request.headers["aa-use"]?.toString() ?? "read",
      method: request.method,
      url: `http://localhost:${port}${url.pathname}`,
      tool: "fetch",
      consequence: "public-read",
      now: new Date()
    });
    response.setHeader("AA-Mandate-Decision", mandate.decision);
    response.end(JSON.stringify({
      title: trustPassport.title,
      summary: "Delegated AI actions need identity, policy, evidence, and receipts.",
      trustPassport: "http://localhost:4024/.well-known/trust-passport.json",
      mandate: {
        decision: mandate.decision,
        reason: mandate.reason
      }
    }, null, 2));
    return;
  }

  response.statusCode = 404;
  response.end(JSON.stringify({ error: "not_found", path: join(url.pathname) }));
}).listen(port, () => {
  console.log(`trust passport publisher listening on http://localhost:${port}`);
});
