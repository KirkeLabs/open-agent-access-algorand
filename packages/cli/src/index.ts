#!/usr/bin/env node
import { checkCommand, fetchCommand } from "./commands/check.js";
import { complianceMapCommand } from "./commands/compliance.js";
import { conformanceRunCommand } from "./commands/conformance.js";
import { doctorCommand } from "./commands/doctor.js";
import { enterpriseExportAuditCommand, enterpriseReportCommand } from "./commands/enterprise.js";
import { evidenceBundleCommand, evidenceVerifyCommand } from "./commands/evidence.js";
import {
  approvalLedgerVerifyCommand,
  approveCommand,
  diffPacketCommand,
  freezeCommand,
  githubRulesetCommand,
  guardCommand,
  guardStatusCommand,
  installHooksCommand,
  vercelReconcileCommand
} from "./commands/guard.js";
import { identityKeygenCommand, identitySignRequestCommand, identityVerifyRequestCommand } from "./commands/identity.js";
import { incidentCheckCommand, incidentStopCommand } from "./commands/incident.js";
import { initCommand } from "./commands/init.js";
import { explainPolicyCommand, exportPolicyCommand, initPolicyCommand, lintPolicyCommand, printPolicyCommand, validatePolicyCommand } from "./commands/policy.js";
import {
  digestReceiptsCommand,
  keygenReceiptsCommand,
  inspectReceiptCommand,
  reconcileReceiptsCommand,
  signReceiptsCommand,
  tailReceiptsCommand,
  verifyReceiptsCommand,
  verifyReceiptSignaturesCommand
} from "./commands/receipts.js";
import { x402TestnetCheckCommand } from "./commands/x402.js";

type Parsed = { positionals: string[]; options: Record<string, string | boolean> };

function parseArgs(argv: string[]): Parsed {
  const positionals: string[] = [];
  const options: Record<string, string | boolean> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[index + 1];
      if (next && !next.startsWith("--")) {
        options[key] = next;
        index += 1;
      } else {
        options[key] = true;
      }
    } else {
      positionals.push(arg);
    }
  }
  return { positionals, options };
}

async function main() {
  const { positionals, options } = parseArgs(process.argv.slice(2));
  const [command, subcommand, target] = positionals;

  if (!command || options.help) {
    printHelp();
    return;
  }

  if (command === "init") return initCommand(options);
  if (command === "conformance" && subcommand === "run") return conformanceRunCommand(Boolean(options.json));
  if (command === "compliance" && subcommand === "map") return complianceMapCommand(options);
  if (command === "doctor") return doctorCommand(options);
  if (command === "enterprise" && subcommand === "report") return enterpriseReportCommand(options);
  if (command === "enterprise" && subcommand === "export-audit" && target) return enterpriseExportAuditCommand(target, options);
  if (command === "evidence" && subcommand === "bundle") return evidenceBundleCommand(options);
  if (command === "evidence" && subcommand === "verify" && target) return evidenceVerifyCommand(target, options);
  if (command === "guard" && subcommand) return guardCommand(subcommand, options);
  if (command === "approve" && subcommand) return approveCommand(subcommand, options);
  if (command === "diff-packet") return diffPacketCommand(options);
  if (command === "freeze" && subcommand) return freezeCommand(subcommand, options);
  if (command === "status") return guardStatusCommand(options);
  if (command === "install-hooks") return installHooksCommand(options);
  if (command === "github" && subcommand === "ruleset-template") return githubRulesetCommand(options);
  if (command === "vercel" && subcommand === "reconcile") return vercelReconcileCommand(options);
  if (command === "approvals" && subcommand === "verify") return approvalLedgerVerifyCommand(options);
  if (command === "x402" && subcommand === "testnet-check") return x402TestnetCheckCommand(options);
  if (command === "identity" && subcommand === "keygen") return identityKeygenCommand(options);
  if (command === "identity" && subcommand === "sign-request") return identitySignRequestCommand(options);
  if (command === "identity" && subcommand === "verify-request") return identityVerifyRequestCommand(options);
  if (command === "incident" && subcommand === "stop") return incidentStopCommand(options);
  if (command === "incident" && subcommand === "check" && target) return incidentCheckCommand(target, options);
  if (command === "policy" && subcommand === "init") return initPolicyCommand(options);
  if (command === "policy" && subcommand === "validate" && target) return validatePolicyCommand(target, Boolean(options.json));
  if (command === "policy" && subcommand === "lint" && target) return lintPolicyCommand(target, Boolean(options.json));
  if (command === "policy" && subcommand === "explain" && target && positionals[3]) return explainPolicyCommand(target, positionals[3], options);
  if (command === "policy" && subcommand === "export" && target) return exportPolicyCommand(target, options);
  if (command === "policy" && subcommand === "print" && target) return printPolicyCommand(target, Boolean(options.json));
  if (command === "check" && subcommand) return checkCommand(subcommand, options);
  if (command === "fetch" && subcommand) return fetchCommand(subcommand, options);
  if (command === "receipts" && subcommand === "verify" && target) return verifyReceiptsCommand(target, Boolean(options.json));
  if (command === "receipts" && subcommand === "digest" && target) return digestReceiptsCommand(target, Boolean(options.json));
  if (command === "receipts" && subcommand === "tail" && target) return tailReceiptsCommand(target, Boolean(options.json));
  if (command === "receipts" && subcommand === "inspect" && target) return inspectReceiptCommand(target, options);
  if (command === "receipts" && subcommand === "reconcile" && target && positionals[3]) return reconcileReceiptsCommand(target, positionals[3], Boolean(options.json));
  if (command === "receipts" && subcommand === "keygen") return keygenReceiptsCommand(
    stringOption(options, "public-key") ?? ".oaa/receipt-public.pem",
    stringOption(options, "private-key") ?? ".oaa/receipt-private.pem",
    Boolean(options.json)
  );
  if (command === "receipts" && subcommand === "sign" && target && positionals[3]) return signReceiptsCommand(
    target,
    positionals[3],
    requiredOption(stringOption(options, "private-key"), "--private-key"),
    stringOption(options, "public-key"),
    Boolean(options.json)
  );
  if (command === "receipts" && subcommand === "verify-signatures" && target) return verifyReceiptSignaturesCommand(
    target,
    stringOption(options, "public-key"),
    Boolean(options.json)
  );
  if (command === "example" && subcommand === "site") {
    console.log("Run: pnpm --filter @kirkelabs/open-agent-access-example-hono-free-and-paid-site dev");
    return;
  }
  if (command === "example" && subcommand === "client") {
    console.log("Run: pnpm --filter @kirkelabs/open-agent-access-example-agent-client dev");
    return;
  }

  throw new Error(`Unknown command: ${positionals.join(" ")}`);
}

function requiredOption(value: string | boolean | undefined, name: string): string {
  if (!value || typeof value !== "string") throw new Error(`${name} is required`);
  return value;
}

function stringOption(options: Record<string, string | boolean>, key: string): string | undefined {
  const value = options[key];
  return typeof value === "string" ? value : undefined;
}

function printHelp() {
  console.log(`Open Agent Access CLI

Commands:
  oaa init [--template static-site|hono|express|fastify|cloudflare|agent-client|algorand-x402] [--origin https://example.com] [--protected /essays] [--force]
  oaa conformance run [--json]
  oaa compliance map [--framework nist-ai-rmf|eu-ai-act|soc2|iso27001|nis2|all] [--json]
  oaa doctor [--payments] [--policy agent-access.json] [--ledger .oaa/receipts.jsonl] [--json]
  oaa enterprise report [--policy agent-access.json] [--mandates agent-mandates.json] [--ledger .oaa/receipts.jsonl] [--json]
  oaa enterprise export-audit .oaa/receipts.jsonl [--format otel|cef] [--redact] [--strict]
  oaa evidence bundle [--policy agent-access.json] [--mandates agent-mandates.json] [--ledger .oaa/receipts.jsonl] [--output oaa-evidence-bundle.json]
  oaa evidence verify oaa-evidence-bundle.json [--json]
  oaa diff-packet --repo-path . --action git.push [--json] [--output packet.md]
  oaa approve git.push --repo-path . --note "Human reviewed diff packet" [--ttl-minutes 30] [--token-file .oaa/approval-token] [--json]
  oaa guard git.push --repo-path . --approval-token TOKEN [--json]
  oaa freeze on|off --repo-path . --reason "Incident review" [--json]
  oaa status --repo-path . [--json]
  oaa install-hooks --repo-path .
  oaa github ruleset-template [--branch main] [--checks CI,CodeQL] [--signed-commits]
  oaa vercel reconcile --repo-path . --production-commit SHA [--deployment-url URL] [--json]
  oaa approvals verify [--ledger .oaa/approval-ledger.jsonl] [--json]
  oaa x402 testnet-check [--live] [--json]
  oaa identity keygen [--public-key .oaa/agent-public.pem] [--private-key .oaa/agent-private.pem]
  oaa identity sign-request --private-key .oaa/agent-private.pem --key-id did:web:agent.example#key-1 --agent-id did:web:agent.example --url URL --purpose research --use read
  oaa identity verify-request --trusted-keys trusted-agent-keys.json --key-id KEY --signature SIG --created ISO --agent-id AGENT --url URL --purpose research --use read --trace-id TRACE
  oaa incident stop [--output agent-stop.json] [--reason incident_response] [--paths /premium/**] [--retry-after 300]
  oaa incident check agent-stop.json [--agent-id AGENT] [--purpose research] [--use read] [--rule-id RULE] [--path /premium/report]
  oaa policy init [--template publisher|paid-api|mcp-tool|docs-site|research-friendly] [--origin https://example.com] [--output agent-access.json] [--force]
  oaa policy validate ./agent-access.json [--json]
  oaa policy lint ./agent-access.json [--json]
  oaa policy explain ./agent-access.json URL [--method GET] [--purpose research] [--use read] [--json]
  oaa policy export ./agent-access.json [--format opa|cedar] [--output ./bundle] [--json]
  oaa policy print https://example.com [--json]
  oaa check URL --purpose research --use read [--budget USD:0.05] [--json]
  oaa fetch URL --purpose research --use read [--budget USD:0.05] [--pay] [--json]
  oaa receipts verify .oaa/receipts.jsonl [--json]
  oaa receipts digest .oaa/receipts.jsonl [--json]
  oaa receipts tail .oaa/receipts.jsonl [--json]
  oaa receipts inspect .oaa/receipts.jsonl [--receipt-id ID] [--trace-id ID] [--json]
  oaa receipts reconcile .oaa/receipts.jsonl .oaa/site-receipts.jsonl [--json]
  oaa receipts keygen [--public-key .oaa/receipt-public.pem] [--private-key .oaa/receipt-private.pem]
  oaa receipts sign .oaa/receipts.jsonl .oaa/signed-receipts.jsonl --private-key .oaa/receipt-private.pem [--public-key .oaa/receipt-public.pem]
  oaa receipts verify-signatures .oaa/signed-receipts.jsonl [--public-key .oaa/receipt-public.pem]
  oaa example site
  oaa example client`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
