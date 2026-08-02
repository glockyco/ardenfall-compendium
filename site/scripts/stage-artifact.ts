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

/**
 * Hand-written declaration for the JavaScript staging script.
 *
 * `stage-artifact.mjs` is plain JavaScript because it runs directly under Node
 * during the site build, before any TypeScript build step exists. It is also
 * the only place artifact tamper detection lives, so the pipeline's manifest tests
 * import it to prove a manipulated artifact is rejected. Declaring its shape here
 * keeps those callers type-checked instead of suppressed.
 */

export interface StageArtifactOptions {
  /** Directory holding `artifact-manifest.json`, `data.sqlite`, assets, and static files. */
  artifactDir: string;
  /** Destination the validated public asset files are copied into. */
  targetDir: string;
  /** Which artifact kind the caller expects. A mismatch is rejected. */
  mode: "fixture" | "release";
}

export interface ArtifactManifest {
  schemaVersion: number;
  artifactKind: "fixture" | "release";
  artifactId: string;
  createdAt: string;
  source: {
    kind: "live-game-export" | "synthetic-fixture";
    fixtureName?: string;
    snapshotId: string;
    gameVersion: string;
    buildIdentifier: string;
    extractorVersion: string;
    snapshotManifestSha256: string;
  };
  git: {
    repository: string;
    commit: string;
    branch: string;
    dirty: boolean;
  };
  diagnostics: {
    fatal: number;
    diagnostic: number;
  };
  counts: ArtifactCounts;
  outputs: {
    sqlite: {
      path: "data.sqlite";
      bytes: number;
      sha256: string;
    };
    assets: {
      path: "assets";
      count: number;
      treeSha256: string;
    };
  };
  probes: {
    items: {
      id: string;
      name: string;
      displayIconHash: string | null;
    }[];
  };
}

interface ArtifactCounts {
  [key: string]: number | undefined;
  itemOverviewRows?: number;
  itemPresentationRows?: number;
  itemOverviewFilters?: number;
  itemOverviewCategories?: number;
  statTypeOverviewRows?: number;
  statTypePresentationRows?: number;
  itemCategoryOverviewRows?: number;
  itemCategoryPresentationRows?: number;
  itemTagOverviewRows?: number;
  itemTagPresentationRows?: number;
}

type CountKey = keyof ArtifactCounts;

type PublicRelease = Pick<
  ArtifactManifest,
  | "createdAt"
  | "schemaVersion"
  | "artifactKind"
  | "artifactId"
  | "source"
  | "git"
  | "diagnostics"
  | "counts"
  | "outputs"
  | "probes"
>;

export interface StageArtifactResult {
  /** The parsed and validated manifest. */
  manifest: ArtifactManifest;
  targetDir: string;
}

/**
 * Validates an artifact and copies its public assets to `targetDir` and its
 * build-time SQLite database to the sibling `.data` directory.
 *
 * Throws when the manifest is missing or invalid, the artifact kind does not
 * match `mode`, a recorded file hash or byte size disagrees with the file on
 * disk, a listed asset is absent, a recorded row count disagrees with the
 * database, or the artifact carries fatal diagnostics.
 */
export async function stageArtifact({
  artifactDir,
  targetDir,
  mode,
}: StageArtifactOptions): Promise<StageArtifactResult> {
  const manifestPath = join(artifactDir, "artifact-manifest.json");
  if (!existsSync(manifestPath)) throw new Error(`missing artifact manifest: ${manifestPath}`);
  const manifest: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (!isArtifactManifest(manifest)) {
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
  const dataDir = join(projectRoot, ".data");

  mkdirSync(targetDir, { recursive: true });
  mkdirSync(dataDir, { recursive: true });
  rmSync(join(targetDir, "data.sqlite"), { force: true });
  rmSync(join(targetDir, "data.sqlite-wal"), { force: true });
  rmSync(join(targetDir, "data.sqlite-shm"), { force: true });
  rmSync(join(dataDir, "data.sqlite"), { force: true });
  rmSync(join(dataDir, "data.sqlite-wal"), { force: true });
  rmSync(join(dataDir, "data.sqlite-shm"), { force: true });
  rmSync(join(targetDir, "_release.json"), { force: true });
  rmSync(join(projectRoot, "_redirects"), { force: true });
  rmSync(join(targetDir, "_redirects"), { force: true });
  rmSync(join(targetDir, "assets"), { recursive: true, force: true });

  copyFileSync(sqlitePath, join(dataDir, "data.sqlite"));
  copyTree(assetsDir, join(targetDir, "assets"));
  copyFileSync(redirectsPath, join(projectRoot, "_redirects"));
  writeFileSync(
    join(targetDir, "_release.json"),
    `${JSON.stringify(publicRelease(manifest), null, 2)}\n`,
  );
  return { manifest, targetDir };
}

function isArtifactManifest(value: unknown): value is ArtifactManifest {
  return validateArtifactManifest(value);
}

function publicRelease(manifest: ArtifactManifest): PublicRelease {
  return {
    createdAt: manifest.createdAt,
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

function assertFileHash(path: string, expectedHash: string, expectedBytes: number): void {
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

function assertAssetTree(dir: string, expectedHash: string): void {
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

function assertSqliteCounts(path: string, counts: ArtifactCounts): void {
  const db = new Database(path, { readonly: true });
  try {
    assertCount(db, counts, "itemOverviewRows", "item_overview_rows");
    assertCount(db, counts, "itemPresentationRows", "item_presentation_rows");
    assertCount(db, counts, "itemOverviewFilters", "item_overview_filters");
    assertCount(db, counts, "itemOverviewCategories", "item_overview_categories");
    assertRequiredCount(db, counts, "statTypeOverviewRows", "stat_type_overview_rows");
    assertRequiredCount(db, counts, "statTypePresentationRows", "stat_type_presentation_rows");
    assertRequiredCount(db, counts, "itemCategoryOverviewRows", "item_category_overview_rows");
    assertRequiredCount(
      db,
      counts,
      "itemCategoryPresentationRows",
      "item_category_presentation_rows",
    );
    assertRequiredCount(db, counts, "itemTagOverviewRows", "item_tag_overview_rows");
    assertRequiredCount(db, counts, "itemTagPresentationRows", "item_tag_presentation_rows");
  } finally {
    db.close();
  }
}

function assertCount(db: Database, counts: ArtifactCounts, key: CountKey, table: string): void {
  const expected = counts[key];
  if (expected === undefined) return;
  const actual = countRows(db, table);
  if (actual !== expected) {
    throw new Error(`${key} mismatch: expected ${expected}, got ${actual}`);
  }
}

function assertRequiredCount(
  db: Database,
  counts: ArtifactCounts,
  key: CountKey,
  table: string,
): void {
  if (counts[key] === undefined) throw new Error(`missing required count ${key}`);
  assertCount(db, counts, key, table);
}

function countRows(db: Database, table: string): number {
  const tableRow = db
    .query<{ name: string }, [string]>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    )
    .get(table);
  if (!tableRow) throw new Error(`missing sqlite table ${table}`);
  // SQLite COUNT aggregates always return one row.
  return db.query<{ count: number }, []>(`SELECT COUNT(*) AS count FROM ${table}`).get()!.count;
}

interface ArtifactMetadataRow {
  key: string;
  value: string;
}

function assertArtifactMetadata(path: string, manifest: ArtifactManifest): void {
  const db = new Database(path, { readonly: true });
  try {
    const rows = db
      .query<ArtifactMetadataRow, []>("SELECT key, value FROM artifact_metadata")
      .all();
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

function copyTree(source: string, target: string): void {
  mkdirSync(target, { recursive: true });
  for (const sourcePath of listFiles(source)) {
    const relative = sourcePath.slice(source.length + 1);
    const targetPath = join(target, relative);
    mkdirSync(dirname(targetPath), { recursive: true });
    copyFileSync(sourcePath, targetPath);
  }
}

function listFiles(dir: string): string[] {
  const files: string[] = [];
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
