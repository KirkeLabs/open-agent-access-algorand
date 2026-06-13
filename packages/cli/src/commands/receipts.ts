import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  canonicalizeJson,
  createReceiptSigningKeyPair,
  exportDigest,
  readReceiptLedger,
  reconcileReceiptLedgers,
  signReceipt,
  verifyReceiptChain,
  verifyReceiptSignature
} from "@kirkelabs/open-agent-access-core";

export async function verifyReceiptsCommand(path: string, json = false) {
  const result = await verifyReceiptChain(path);
  console.log(json ? JSON.stringify(result, null, 2) : result.valid ? `valid chain (${result.count} receipts)` : `invalid chain\n${result.errors.join("\n")}`);
  if (!result.valid) {
    process.exitCode = 1;
  }
}

export async function digestReceiptsCommand(path: string, json = false) {
  const digest = await exportDigest(path);
  console.log(json ? JSON.stringify(digest, null, 2) : `count: ${digest.count}\nhead: ${digest.head ?? "(empty)"}\nledgerHash: ${digest.ledgerHash}`);
}

export async function tailReceiptsCommand(path: string, json = false) {
  const receipts = await readReceiptLedger(path);
  const last = receipts.at(-1);
  if (json) {
    console.log(JSON.stringify(last ?? null, null, 2));
    return;
  }
  if (!last) {
    console.log("no receipts");
    return;
  }
  console.log(`${last.timestamp} ${last.role} ${last.policy?.decision ?? "unknown"} ${last.method} ${last.url}`);
  console.log(`receiptId: ${last.receiptId}`);
  console.log(`receiptHash: ${last.receiptHash}`);
}

export async function inspectReceiptCommand(path: string, options: Record<string, string | boolean | undefined>) {
  const receipts = await readReceiptLedger(path);
  const receiptId = typeof options.receiptId === "string" ? options.receiptId : typeof options["receipt-id"] === "string" ? options["receipt-id"] : undefined;
  const traceId = typeof options.traceId === "string" ? options.traceId : typeof options["trace-id"] === "string" ? options["trace-id"] : undefined;
  const receipt = receiptId
    ? receipts.find((entry) => entry.receiptId === receiptId)
    : traceId
      ? receipts.find((entry) => entry.traceId === traceId)
      : receipts.at(-1);
  if (!receipt) {
    console.log("receipt not found");
    process.exitCode = 1;
    return;
  }
  const chain = await verifyReceiptChain(path);
  const signatureValid = receipt.signature ? verifyReceiptSignature(receipt) : undefined;
  const result = { receipt, chainValid: chain.valid, signatureValid };
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(`receiptId: ${receipt.receiptId}`);
  console.log(`traceId: ${receipt.traceId}`);
  console.log(`role: ${receipt.role}`);
  console.log(`decision: ${receipt.policy?.decision ?? "unknown"}`);
  console.log(`method: ${receipt.method}`);
  console.log(`url: ${receipt.url}`);
  console.log(`ruleId: ${receipt.policy?.ruleId ?? "unknown"}`);
  console.log(`policyHash: ${receipt.policy?.policyHash ?? "unknown"}`);
  console.log(`paymentRequired: ${receipt.payment?.required ?? false}`);
  if (receipt.payment?.price) console.log(`price: ${receipt.payment.price.currency} ${receipt.payment.price.amount}`);
  console.log(`responseStatus: ${receipt.response?.status ?? "unknown"}`);
  console.log(`chainValid: ${chain.valid}`);
  console.log(`signatureValid: ${signatureValid === undefined ? "unsigned" : signatureValid}`);
}

export async function reconcileReceiptsCommand(agentPath: string, sitePath: string, json = false) {
  const result = await reconcileReceiptLedgers(agentPath, sitePath);
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.valid) {
    console.log(`valid reconciliation (${result.matched} matched receipts)`);
  } else {
    console.log(`invalid reconciliation (${result.matched} matched receipts)`);
    if (result.agentLedgerErrors.length) console.log(`agent ledger errors: ${result.agentLedgerErrors.join("; ")}`);
    if (result.siteLedgerErrors.length) console.log(`site ledger errors: ${result.siteLedgerErrors.join("; ")}`);
    if (result.missingSiteReceipts.length) console.log(`missing site receipts: ${result.missingSiteReceipts.join(", ")}`);
    if (result.missingAgentReceipts.length) console.log(`missing agent receipts: ${result.missingAgentReceipts.join(", ")}`);
    for (const mismatch of result.mismatches) {
      console.log(`mismatch ${mismatch.traceId} ${mismatch.field}: agent=${JSON.stringify(mismatch.agentValue)} site=${JSON.stringify(mismatch.siteValue)}`);
    }
  }
  if (!result.valid) {
    process.exitCode = 1;
  }
}

export async function keygenReceiptsCommand(publicKeyPath: string, privateKeyPath: string, json = false) {
  const keys = createReceiptSigningKeyPair();
  await mkdir(dirname(publicKeyPath), { recursive: true });
  await mkdir(dirname(privateKeyPath), { recursive: true });
  await writeFile(publicKeyPath, keys.publicKeyPem, { flag: "wx" });
  await writeFile(privateKeyPath, keys.privateKeyPem, { flag: "wx", mode: 0o600 });
  if (json) {
    console.log(JSON.stringify({ publicKeyPath, privateKeyPath }, null, 2));
  } else {
    console.log(`created public key: ${publicKeyPath}`);
    console.log(`created private key: ${privateKeyPath}`);
  }
}

export async function signReceiptsCommand(inputPath: string, outputPath: string, privateKeyPath: string, publicKeyPath: string | undefined, json = false) {
  const privateKeyPem = await readFile(privateKeyPath, "utf8");
  const publicKeyPem = publicKeyPath ? await readFile(publicKeyPath, "utf8") : undefined;
  const receipts = await readReceiptLedger(inputPath);
  const signed = receipts.map((receipt) => signReceipt(receipt, privateKeyPem, publicKeyPem));
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, signed.map((receipt) => canonicalizeJson(receipt)).join("\n") + (signed.length ? "\n" : ""), "utf8");
  if (json) {
    console.log(JSON.stringify({ inputPath, outputPath, signed: signed.length }, null, 2));
  } else {
    console.log(`signed ${signed.length} receipts -> ${outputPath}`);
  }
}

export async function verifyReceiptSignaturesCommand(path: string, publicKeyPath: string | undefined, json = false) {
  const publicKeyPem = publicKeyPath ? await readFile(publicKeyPath, "utf8") : undefined;
  const receipts = await readReceiptLedger(path);
  const failures: string[] = [];
  receipts.forEach((receipt, index) => {
    if (!verifyReceiptSignature(receipt, publicKeyPem)) {
      failures.push(`line ${index + 1}: invalid or missing signature`);
    }
  });
  const result = { valid: failures.length === 0, count: receipts.length, failures };
  console.log(json ? JSON.stringify(result, null, 2) : result.valid ? `valid signatures (${receipts.length} receipts)` : `invalid signatures\n${failures.join("\n")}`);
  if (!result.valid) process.exitCode = 1;
}
