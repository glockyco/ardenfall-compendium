import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const defaultSourceDir = resolve(import.meta.dirname, "../../pipeline/dist");
const defaultTargetDir = resolve(import.meta.dirname, "../static");

function assertNonEmptyFile(path, label) {
  if (!existsSync(path)) {
    throw new Error(
      `Missing generated ${label} at ${path}. Run controller export or pipeline:run before deploying.`,
    );
  }
  const info = statSync(path);
  if (!info.isFile() || info.size === 0) {
    throw new Error(`Invalid generated ${label} at ${path}. Expected a non-empty file.`);
  }
  return info.size;
}

function listFilesRecursive(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFilesRecursive(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function copyTree(source, target) {
  mkdirSync(target, { recursive: true });
  for (const sourcePath of listFilesRecursive(source)) {
    const relative = sourcePath.slice(source.length + 1);
    const targetPath = join(target, relative);
    assertNonEmptyFile(sourcePath, `asset ${relative}`);
    mkdirSync(dirname(targetPath), { recursive: true });
    copyFileSync(sourcePath, targetPath);
  }
}

export function syncGeneratedArtifacts({
  sourceDir = defaultSourceDir,
  targetDir = defaultTargetDir,
} = {}) {
  const sqliteSource = join(sourceDir, "data.sqlite");
  const sqliteBytes = assertNonEmptyFile(sqliteSource, "SQLite output");

  const sourceAssets = join(sourceDir, "assets");
  if (!existsSync(sourceAssets) || !statSync(sourceAssets).isDirectory()) {
    throw new Error(
      `Missing generated asset bundle at ${sourceAssets}. Run pipeline:run before deploying.`,
    );
  }
  const assetFiles = listFilesRecursive(sourceAssets).filter((path) => path.endsWith(".webp"));
  if (assetFiles.length === 0) {
    throw new Error(`Missing generated WebP assets under ${sourceAssets}.`);
  }

  mkdirSync(targetDir, { recursive: true });
  copyFileSync(sqliteSource, join(targetDir, "data.sqlite"));

  const targetAssets = join(targetDir, "assets");
  rmSync(targetAssets, { recursive: true, force: true });
  copyTree(sourceAssets, targetAssets);

  return { sourceDir, targetDir, sqliteBytes, assetCount: assetFiles.length };
}

if (import.meta.main) {
  const result = syncGeneratedArtifacts();
  process.stdout.write(
    `synced generated artifacts ${result.sourceDir} -> ${result.targetDir} (${result.sqliteBytes} sqlite bytes, ${result.assetCount} assets)\n`,
  );
}
