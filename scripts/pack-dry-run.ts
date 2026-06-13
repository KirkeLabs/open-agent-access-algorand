import { readdir, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

for (const manifest of await packageManifestPaths()) {
  const dir = manifest.replace(/\/package\.json$/, "");
  const result = spawnSync("npm", ["pack", "--dry-run", "--json"], {
    cwd: dir,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    console.error(`pack dry-run failed for ${dir}`);
    console.error(result.stdout);
    console.error(result.stderr);
    process.exit(1);
  }
  console.log(`pack dry-run passed: ${dir}`);
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

async function exists(path: string) {
  return stat(path).then(() => true).catch(() => false);
}
