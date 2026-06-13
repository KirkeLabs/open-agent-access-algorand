import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";

const packagesDir = "packages";
const compiledRoot = join("dist", "packages");

for (const packageName of await readdir(packagesDir)) {
  const packageDir = join(packagesDir, packageName);
  const sourceDir = join(compiledRoot, packageName, "src");
  const targetDir = join(packageDir, "dist");

  if (!await exists(join(packageDir, "package.json")) || !await exists(sourceDir)) {
    continue;
  }

  await rm(targetDir, { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });
  await cp(sourceDir, targetDir, { recursive: true });
}

async function exists(path) {
  return stat(path).then(() => true).catch(() => false);
}
