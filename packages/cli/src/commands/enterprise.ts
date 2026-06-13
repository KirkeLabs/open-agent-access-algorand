import { readFile } from "node:fs/promises";
import {
  createEnterpriseControlReport,
  createEvidenceBundleDigest,
  receiptToCefEvent,
  receiptToOpenTelemetrySpan
} from "@kirkelabs/open-agent-access-enterprise";
import { readPolicyFile, readReceiptLedger } from "@kirkelabs/open-agent-access-core";
import { validateMandateDocument } from "@kirkelabs/open-agent-access-mandates";

export async function enterpriseReportCommand(options: Record<string, string | boolean | undefined>) {
  const policyPath = stringOption(options, "policy") ?? "agent-access.json";
  const mandatePath = stringOption(options, "mandates");
  const ledgerPath = stringOption(options, "ledger");
  const policy = await readPolicyFile(policyPath);
  const mandateDocument = mandatePath
    ? validateMandateDocument(JSON.parse(await readFile(mandatePath, "utf8")))
    : undefined;
  const receipts = ledgerPath ? await readReceiptLedger(ledgerPath) : undefined;
  const report = createEnterpriseControlReport({ policy, mandateDocument, receipts });
  const digest = createEvidenceBundleDigest({ policy, mandateDocument, receipts });

  if (options.json) {
    console.log(JSON.stringify({ report, digest }, null, 2));
    if (!report.ok) process.exitCode = 1;
    return;
  }

  console.log(`enterprise report: ${report.ok ? "ok" : "needs attention"} score=${report.score}`);
  console.log(`policyHash=${report.policyHash}`);
  if (report.mandateDocumentHash) console.log(`mandateDocumentHash=${report.mandateDocumentHash}`);
  console.log(`bundleHash=${digest.bundleHash}`);
  for (const finding of report.findings) {
    console.log(`${finding.severity} ${finding.id} ${finding.title}`);
    console.log(`  ${finding.recommendation}`);
  }
  if (!report.ok) process.exitCode = 1;
}

export async function enterpriseExportAuditCommand(ledgerPath: string, options: Record<string, string | boolean | undefined>) {
  const receipts = await readReceiptLedger(ledgerPath);
  const format = stringOption(options, "format") ?? "otel";
  const redact = Boolean(options.redact);
  const redactionMode = options.strict ? "strict" : "pii-safe";
  if (format === "cef") {
    for (const receipt of receipts) {
      console.log(receiptToCefEvent(receipt, { redact, redactionMode }));
    }
    return;
  }
  if (format !== "otel") {
    throw new Error("--format must be otel or cef");
  }
  const spans = receipts.map((receipt) => receiptToOpenTelemetrySpan(receipt, { redact, redactionMode }));
  console.log(JSON.stringify(spans, null, 2));
}

function stringOption(options: Record<string, string | boolean | undefined>, key: string): string | undefined {
  const value = options[key];
  return typeof value === "string" ? value : undefined;
}
