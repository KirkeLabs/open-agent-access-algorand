import { readFile, writeFile } from "node:fs/promises";
import { createEvidenceBundle, verifyEvidenceBundle, type EvidenceBundle } from "@open-agent-access/evidence";
import { readPolicyFile, readReceiptLedger } from "@open-agent-access/core";
import { validateMandateDocument } from "@open-agent-access/mandates";

export async function evidenceBundleCommand(options: Record<string, string | boolean | undefined>) {
  const policyPath = stringOption(options, "policy");
  const mandatePath = stringOption(options, "mandates");
  const ledgerPath = stringOption(options, "ledger");
  const outputPath = stringOption(options, "output") ?? "oaa-evidence-bundle.json";
  const policy = policyPath ? await readPolicyFile(policyPath) : undefined;
  const mandateDocument = mandatePath
    ? validateMandateDocument(JSON.parse(await readFile(mandatePath, "utf8")))
    : undefined;
  const receipts = ledgerPath ? await readReceiptLedger(ledgerPath) : undefined;
  const bundle = createEvidenceBundle({ policy, mandateDocument, receipts });
  await writeFile(outputPath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  if (options.json) {
    console.log(JSON.stringify({ outputPath, bundle }, null, 2));
    return;
  }
  console.log(`evidence bundle written: ${outputPath}`);
  console.log(`bundleHash=${bundle.bundleHash}`);
}

export async function evidenceVerifyCommand(path: string, options: Record<string, string | boolean | undefined>) {
  const bundle = JSON.parse(await readFile(path, "utf8")) as EvidenceBundle;
  const result = verifyEvidenceBundle(bundle);
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    if (!result.valid) process.exitCode = 1;
    return;
  }
  console.log(`${result.valid ? "ok" : "fail"} evidence bundle: ${path}`);
  if (!result.valid) {
    for (const error of result.errors) console.log(`  ${error}`);
    process.exitCode = 1;
  }
}

function stringOption(options: Record<string, string | boolean | undefined>, key: string): string | undefined {
  const value = options[key];
  return typeof value === "string" ? value : undefined;
}
