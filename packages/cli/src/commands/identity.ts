import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import {
  createAgentIdentityKeyPair,
  parseTrustedAgentKeys,
  signAgentAccessHeaders,
  verifyAgentAccessHeaders
} from "@kirkelabs/open-agent-access-identity";
import { buildAgentAccessHeaders } from "@kirkelabs/open-agent-access-core";

export async function identityKeygenCommand(options: Record<string, string | boolean | undefined>) {
  const publicKeyPath = stringOption(options, "public-key") ?? ".oaa/agent-public.pem";
  const privateKeyPath = stringOption(options, "private-key") ?? ".oaa/agent-private.pem";
  const keys = createAgentIdentityKeyPair();
  await mkdir(dirname(publicKeyPath), { recursive: true });
  await mkdir(dirname(privateKeyPath), { recursive: true });
  await writeFile(publicKeyPath, keys.publicKeyPem, { encoding: "utf8", mode: 0o644 });
  await writeFile(privateKeyPath, keys.privateKeyPem, { encoding: "utf8", mode: 0o600 });
  if (options.json) {
    console.log(JSON.stringify({ publicKeyPath, privateKeyPath }, null, 2));
    return;
  }
  console.log(`agent public key written: ${publicKeyPath}`);
  console.log(`agent private key written: ${privateKeyPath}`);
  console.log("Do not commit private keys. Use this flow for local/dev signing only.");
}

export async function identityVerifyRequestCommand(options: Record<string, string | boolean | undefined>) {
  const trustedKeysPath = requiredOption(stringOption(options, "trusted-keys"), "--trusted-keys");
  const method = stringOption(options, "method") ?? "GET";
  const url = requiredOption(stringOption(options, "url"), "--url");
  const headers = buildAgentAccessHeaders({
    agent: {
      id: requiredOption(stringOption(options, "agent-id"), "--agent-id"),
      name: stringOption(options, "agent-name"),
      operator: stringOption(options, "agent-operator"),
      principal: stringOption(options, "agent-principal")
    },
    purpose: requiredOption(stringOption(options, "purpose"), "--purpose"),
    use: requiredOption(stringOption(options, "use"), "--use"),
    traceId: requiredOption(stringOption(options, "trace-id"), "--trace-id")
  });
  headers.set("AA-Agent-Key-ID", requiredOption(stringOption(options, "key-id"), "--key-id"));
  headers.set("AA-Agent-Signature-Created", requiredOption(stringOption(options, "created"), "--created"));
  headers.set("AA-Agent-Signature", requiredOption(stringOption(options, "signature"), "--signature"));
  const trustedKeys = parseTrustedAgentKeys(JSON.parse(await readFile(trustedKeysPath, "utf8")));
  const result = verifyAgentAccessHeaders(headers, { method, url, trustedKeys });
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
    return;
  }
  console.log(`${result.ok ? "ok" : "fail"} agent identity: ${result.reason}`);
  if (!result.ok) process.exitCode = 1;
}

export async function identitySignRequestCommand(options: Record<string, string | boolean | undefined>) {
  const privateKeyPath = requiredOption(stringOption(options, "private-key"), "--private-key");
  const privateKeyPem = await readFile(privateKeyPath, "utf8");
  const method = stringOption(options, "method") ?? "GET";
  const url = requiredOption(stringOption(options, "url"), "--url");
  const headers = buildAgentAccessHeaders({
    agent: {
      id: requiredOption(stringOption(options, "agent-id"), "--agent-id"),
      name: stringOption(options, "agent-name"),
      operator: stringOption(options, "agent-operator"),
      principal: stringOption(options, "agent-principal")
    },
    purpose: requiredOption(stringOption(options, "purpose"), "--purpose"),
    use: requiredOption(stringOption(options, "use"), "--use"),
    traceId: stringOption(options, "trace-id") ?? randomUUID()
  });
  signAgentAccessHeaders(headers, {
    method,
    url,
    privateKeyPem,
    keyId: requiredOption(stringOption(options, "key-id"), "--key-id")
  });
  const output: Record<string, string> = {};
  headers.forEach((value, key) => {
    output[key] = value;
  });
  console.log(JSON.stringify(output, null, 2));
}

function requiredOption(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function stringOption(options: Record<string, string | boolean | undefined>, key: string): string | undefined {
  const value = options[key];
  return typeof value === "string" ? value : undefined;
}
