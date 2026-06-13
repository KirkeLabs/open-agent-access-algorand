import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const allowed = new Set([
  ".env.example",
  "README.md",
  "SECURITY.md",
  "docs/ALGORAND_X402.md"
]);

const patterns = [
  { name: "secret_env_assignment", regex: /(?:^|\n)\s*(?:export\s+)?(?:AVM_MNEMONIC|MNEMONIC|SEED_PHRASE|PRIVATE_KEY)\s*=\s*["']?[a-zA-Z0-9][^"'\n]{12,}/i },
  { name: "algorand_mnemonic_words", regex: /\b([a-z]{3,12}\s+){24}[a-z]{3,12}\b/i },
  { name: "private_key_block", regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ }
];

const findings: string[] = [];
for (const file of await listFiles(".")) {
  if (allowed.has(file) || file.endsWith("pnpm-lock.yaml")) {
    continue;
  }
  const text = await readFile(file, "utf8").catch(() => "");
  for (const pattern of patterns) {
    if (pattern.regex.test(text)) {
      findings.push(`${file}: ${pattern.name}`);
    }
  }
}

if (findings.length) {
  console.error("Potential secret material detected:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log("secret check passed");

async function listFiles(root: string): Promise<string[]> {
  const ignoredDirectories = new Set([".git", "node_modules", "dist", "coverage", ".oaa"]);
  const results: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    const fullPath = join(root, entry.name);
    const relativePath = fullPath.startsWith("./") ? fullPath.slice(2) : fullPath;
    if (entry.isDirectory()) {
      results.push(...await listFiles(relativePath));
      continue;
    }
    if (entry.isFile() && await isReadableTextFile(relativePath)) {
      results.push(relativePath);
    }
  }
  return results;
}

async function isReadableTextFile(path: string) {
  const info = await stat(path).catch(() => undefined);
  if (!info?.isFile()) return false;
  return !/\.(png|jpg|jpeg|gif|webp|pdf|ico|zip|gz|tgz)$/i.test(path);
}
