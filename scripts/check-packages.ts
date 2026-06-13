import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

interface PackageJson {
  name?: string;
  version?: string;
  license?: string;
  type?: string;
  main?: string;
  types?: string;
  exports?: unknown;
  publishConfig?: { access?: string };
  files?: string[];
  bin?: Record<string, string>;
}

const failures: string[] = [];
for (const manifestPath of await packageManifestPaths()) {
  const packageDir = manifestPath.slice(0, -"package.json".length).replace(/\/$/, "");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as PackageJson;
  check(Boolean(manifest.name?.startsWith("@kirkelabs/open-agent-access")), manifestPath, "package name must use the @kirkelabs/open-agent-access package family");
  check(Boolean(manifest.version), manifestPath, "version is required");
  check(manifest.license === "Apache-2.0", manifestPath, "license must be Apache-2.0");
  check(manifest.type === "module", manifestPath, "type must be module");
  check(Boolean(manifest.exports), manifestPath, "exports map is required");
  check(manifest.main === "dist/index.js", manifestPath, "main must point to dist/index.js");
  check(manifest.types === "dist/index.d.ts", manifestPath, "types must point to dist/index.d.ts");
  check(manifest.publishConfig?.access === "public", manifestPath, "publishConfig.access must be public");
  check(Boolean(manifest.files?.includes("src")), manifestPath, "files must include src");
  check(Boolean(manifest.files?.includes("dist")), manifestPath, "files must include dist");
  check(Boolean(manifest.files?.includes("README.md")), manifestPath, "files must include README.md");
  check(await exists(join(packageDir, "README.md")), manifestPath, "package README.md is required");
  check(await exists(join(packageDir, "src", "index.ts")), manifestPath, "src/index.ts is required");
  check(await exists(join(packageDir, "dist", "index.js")), manifestPath, "dist/index.js is required; run pnpm build first");
  check(await exists(join(packageDir, "dist", "index.d.ts")), manifestPath, "dist/index.d.ts is required; run pnpm build first");
  for (const [binName, binPath] of Object.entries(manifest.bin ?? {})) {
    check(binPath === "dist/index.js", manifestPath, `bin ${binName} must point to dist/index.js`);
  }
}

if (failures.length) {
  console.error("package check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("package check passed");

function check(condition: boolean, manifestPath: string, message: string) {
  if (!condition) failures.push(`${manifestPath}: ${message}`);
}

async function exists(path: string) {
  return stat(path).then(() => true).catch(() => false);
}

async function packageManifestPaths() {
  const entries = await readdir("packages", { withFileTypes: true });
  const manifests: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join("packages", entry.name, "package.json");
    if (await exists(manifestPath)) manifests.push(manifestPath);
  }
  return manifests.sort();
}
