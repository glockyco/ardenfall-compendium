import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import validateArtifactManifest from "../../pipeline/dist/validate-artifact-manifest.mjs";

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

function loadManifest(sourceDir) {
  const manifestPath = join(sourceDir, "artifact-manifest.json");
  if (!existsSync(manifestPath)) throw new Error(`missing artifact manifest: ${manifestPath}`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (!validateArtifactManifest(manifest)) {
    const detail = (validateArtifactManifest.errors ?? [])
      .map((error) => `artifact-manifest.json#${error.instancePath} — ${error.message}`)
      .join("\n");
    throw new Error(`invalid artifact manifest:\n${detail}`);
  }
  if (manifest.diagnostics?.fatal !== 0) {
    throw new Error(`artifact has fatal diagnostics: ${manifest.diagnostics?.fatal}`);
  }
  return manifest;
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function assertFileHash(path, expectedHash, expectedBytes) {
  const bytes = assertNonEmptyFile(path, "SQLite output");
  if (bytes !== expectedBytes) {
    throw new Error(
      `artifact file size mismatch for ${path}: expected ${expectedBytes}, got ${bytes}`,
    );
  }
  const actualHash = sha256(path);
  if (actualHash !== expectedHash) {
    throw new Error(
      `artifact file hash mismatch for ${path}: expected ${expectedHash}, got ${actualHash}`,
    );
  }
  return bytes;
}

function assetTreeHash(dir) {
  const entries = listFilesRecursive(dir).map((path) => {
    const relative = path.slice(dir.length + 1).replaceAll("\\", "/");
    return `${relative}\0${sha256(path)}`;
  });
  return createHash("sha256").update(entries.join("\n")).digest("hex");
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
  const manifest = loadManifest(sourceDir);
  const sqliteBytes = assertFileHash(
    sqliteSource,
    manifest.outputs.sqlite.sha256,
    manifest.outputs.sqlite.bytes,
  );

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
  const actualAssetHash = assetTreeHash(sourceAssets);
  if (actualAssetHash !== manifest.outputs.assets.treeSha256) {
    throw new Error(
      `asset tree hash mismatch: expected ${manifest.outputs.assets.treeSha256}, got ${actualAssetHash}`,
    );
  }
  if (assetFiles.length !== manifest.outputs.assets.count) {
    throw new Error(
      `asset count mismatch: expected ${manifest.outputs.assets.count}, got ${assetFiles.length}`,
    );
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
