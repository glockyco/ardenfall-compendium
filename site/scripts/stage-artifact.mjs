import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import validateArtifactManifest from "../../pipeline/dist/validate-artifact-manifest.mjs";

export async function stageArtifact({ artifactDir, targetDir, mode }) {
  const manifestPath = join(artifactDir, "artifact-manifest.json");
  if (!existsSync(manifestPath)) throw new Error(`missing artifact manifest: ${manifestPath}`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (!validateArtifactManifest(manifest)) {
    const detail = (validateArtifactManifest.errors ?? [])
      .map((error) => `artifact-manifest.json#${error.instancePath} — ${error.message}`)
      .join("\n");
    throw new Error(`invalid artifact manifest:\n${detail}`);
  }

  if (mode === "release" && manifest.artifactKind !== "release") {
    throw new Error(`release staging requires artifactKind release, got ${manifest.artifactKind}`);
  }
  if (mode === "fixture" && manifest.artifactKind !== "fixture") {
    throw new Error(`fixture staging requires artifactKind fixture, got ${manifest.artifactKind}`);
  }
  if (mode === "release" && manifest.source?.kind !== "live-game-export") {
    throw new Error(
      `release staging requires live-game-export source, got ${manifest.source?.kind}`,
    );
  }
  if (manifest.diagnostics?.fatal !== 0) {
    throw new Error(`artifact has fatal diagnostics: ${manifest.diagnostics?.fatal}`);
  }

  const sqlitePath = join(artifactDir, "data.sqlite");
  const assetsDir = join(artifactDir, "assets");
  assertFileHash(sqlitePath, manifest.outputs.sqlite.sha256, manifest.outputs.sqlite.bytes);
  assertAssetTree(assetsDir, manifest.outputs.assets.treeSha256);
  assertSqliteCounts(sqlitePath, manifest.counts);
  assertArtifactMetadata(sqlitePath, manifest);
  const redirectsPath = join(artifactDir, "static", "_redirects");
  if (!existsSync(redirectsPath)) throw new Error(`missing redirects artifact: ${redirectsPath}`);

  const projectRoot = dirname(targetDir);

  mkdirSync(targetDir, { recursive: true });
  rmSync(join(targetDir, "data.sqlite"), { force: true });
  rmSync(join(targetDir, "_release.json"), { force: true });
  rmSync(join(projectRoot, "_redirects"), { force: true });
  rmSync(join(targetDir, "_redirects"), { force: true });
  rmSync(join(targetDir, "assets"), { recursive: true, force: true });

  copyFileSync(sqlitePath, join(targetDir, "data.sqlite"));
  copyTree(assetsDir, join(targetDir, "assets"));
  copyFileSync(redirectsPath, join(projectRoot, "_redirects"));
  writeFileSync(
    join(targetDir, "_release.json"),
    `${JSON.stringify(publicRelease(manifest), null, 2)}\n`,
  );
  return { manifest, targetDir };
}

function publicRelease(manifest) {
  return {
    schemaVersion: manifest.schemaVersion,
    artifactKind: manifest.artifactKind,
    artifactId: manifest.artifactId,
    source: manifest.source,
    git: manifest.git,
    diagnostics: manifest.diagnostics,
    counts: manifest.counts,
    outputs: manifest.outputs,
    probes: manifest.probes,
  };
}

function assertFileHash(path, expectedHash, expectedBytes) {
  const info = statSync(path);
  if (info.size !== expectedBytes) {
    throw new Error(
      `artifact file size mismatch for ${path}: expected ${expectedBytes}, got ${info.size}`,
    );
  }
  const actualHash = createHash("sha256").update(readFileSync(path)).digest("hex");
  if (actualHash !== expectedHash) {
    throw new Error(
      `artifact file hash mismatch for ${path}: expected ${expectedHash}, got ${actualHash}`,
    );
  }
}

function assertAssetTree(dir, expectedHash) {
  const entries = listFiles(dir).map((path) => {
    const relative = path.slice(dir.length + 1).replaceAll("\\", "/");
    const hash = createHash("sha256").update(readFileSync(path)).digest("hex");
    return `${relative}\0${hash}`;
  });
  const actualHash = createHash("sha256").update(entries.join("\n")).digest("hex");
  if (actualHash !== expectedHash) {
    throw new Error(`asset tree hash mismatch: expected ${expectedHash}, got ${actualHash}`);
  }
}

function assertSqliteCounts(path, counts) {
  const db = new Database(path, { readonly: true });
  try {
    assertCount(db, counts, "itemOverviewRows", "item_overview_rows");
    assertCount(db, counts, "itemPresentationRows", "item_presentation_rows");
    assertCount(db, counts, "itemOverviewFilters", "item_overview_filters");
    assertCount(db, counts, "itemOverviewCategories", "item_overview_categories");
    assertRequiredCount(db, counts, "statTypeOverviewRows", "stat_type_overview_rows");
    assertRequiredCount(db, counts, "statTypePresentationRows", "stat_type_presentation_rows");
  } finally {
    db.close();
  }
}

function assertCount(db, counts, key, table) {
  if (counts[key] === undefined) return;
  const actual = countRows(db, table);
  if (actual !== counts[key]) {
    throw new Error(`${key} mismatch: expected ${counts[key]}, got ${actual}`);
  }
}

function assertRequiredCount(db, counts, key, table) {
  if (counts[key] === undefined) throw new Error(`missing required count ${key}`);
  assertCount(db, counts, key, table);
}

function countRows(db, table) {
  const tableRow = db
    .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table);
  if (!tableRow) throw new Error(`missing sqlite table ${table}`);
  return db.query(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
}

function assertArtifactMetadata(path, manifest) {
  const db = new Database(path, { readonly: true });
  try {
    const rows = db.query("SELECT key, value FROM artifact_metadata").all();
    const metadata = new Map(rows.map((row) => [row.key, row.value]));
    const expected = {
      artifactKind: manifest.artifactKind,
      artifactId: manifest.artifactId,
      sourceKind: manifest.source.kind,
      sourceSnapshotId: manifest.source.snapshotId,
      gitCommit: manifest.git.commit,
    };
    for (const [key, value] of Object.entries(expected)) {
      if (metadata.get(key) !== value) {
        throw new Error(
          `artifact metadata mismatch for ${key}: expected ${value}, got ${metadata.get(key) ?? "missing"}`,
        );
      }
    }
  } finally {
    db.close();
  }
}

function copyTree(source, target) {
  mkdirSync(target, { recursive: true });
  for (const sourcePath of listFiles(source)) {
    const relative = sourcePath.slice(source.length + 1);
    const targetPath = join(target, relative);
    mkdirSync(dirname(targetPath), { recursive: true });
    copyFileSync(sourcePath, targetPath);
  }
}

function listFiles(dir) {
  const files = [];
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files.sort();
}

if (import.meta.main) {
  const artifactDir = Bun.argv[2] ? resolve(Bun.argv[2]) : null;
  const modeArg = Bun.argv.includes("--mode") ? Bun.argv[Bun.argv.indexOf("--mode") + 1] : null;
  if (!artifactDir || (modeArg !== "fixture" && modeArg !== "release")) {
    throw new Error("usage: stage-artifact <artifactDir> --mode <fixture|release>");
  }
  const result = await stageArtifact({
    artifactDir,
    targetDir: resolve(import.meta.dirname, "../static"),
    mode: modeArg,
  });
  process.stdout.write(
    `staged ${result.manifest.artifactKind} artifact ${result.manifest.artifactId}\n`,
  );
}
