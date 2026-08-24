import { Database } from "bun:sqlite";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import validateArtifactManifest from "../../dist/validate-artifact-manifest.mjs";
import { sha256File, sha256Json, sha256Tree } from "./hash";
import { validateDeployableSqlite } from "./sqlite-validation";
import type { ArtifactKind, ArtifactManifest } from "../types";
import type { EmitAssetsOutput } from "../stages/emit-assets";
import type { EmitSqliteOutput } from "../stages/emit-sqlite";
import type { LoadSnapshotOutput } from "../stages/load-snapshot";

export interface BuildArtifactManifestInput {
  artifactKind: ArtifactKind;
  artifactId: string;
  artifactDir: string;
  snapshot: LoadSnapshotOutput;
  sqliteOutput: EmitSqliteOutput;
  assetsOutput: EmitAssetsOutput;
}

export async function buildArtifactManifest(
  input: BuildArtifactManifestInput,
): Promise<ArtifactManifest> {
  const sourceKind = input.snapshot.manifest.source.kind;
  if (input.artifactKind === "release" && sourceKind !== "live-game-export") {
    throw new Error("release artifacts require live-game-export snapshots");
  }
  if (input.artifactKind === "fixture" && sourceKind !== "synthetic-fixture") {
    throw new Error("fixture artifacts require synthetic-fixture snapshots");
  }

  const sqlitePath = join(input.artifactDir, "data.sqlite");
  const assetsDir = join(input.artifactDir, "assets");
  const probes = readItemProbes(sqlitePath);
  const uniqueAssetHashes = new Set(input.assetsOutput.refs.map((ref) => ref.assetHash));
  const git = readGitIdentity();
  const snapshotId = `${input.snapshot.manifest.gameVersion ?? "unknown"}-${input.snapshot.manifest.buildIdentifier ?? "unknown"}`;
  writeArtifactMetadata(sqlitePath, {
    artifactKind: input.artifactKind,
    artifactId: input.artifactId,
    sourceKind,
    sourceSnapshotId: snapshotId,
    gitCommit: git.commit,
  });
  validateDeployableSqlite(sqlitePath);
  const sqliteBytes = Bun.file(sqlitePath).size;
  const manifest: ArtifactManifest = {
    schemaVersion: 1,
    artifactKind: input.artifactKind,
    artifactId: input.artifactId,
    createdAt: new Date().toISOString(),
    source: {
      kind: sourceKind,
      ...(input.snapshot.manifest.source.kind === "synthetic-fixture"
        ? { fixtureName: input.snapshot.manifest.source.fixtureName }
        : {}),
      snapshotId,
      gameVersion: input.snapshot.manifest.gameVersion ?? "unknown",
      buildIdentifier: input.snapshot.manifest.buildIdentifier ?? "unknown",
      productName: input.snapshot.manifest.productName,
      buildProfile: input.snapshot.manifest.buildProfile,
      extractorVersion: input.snapshot.manifest.extractorVersion,
      snapshotManifestSha256: sha256Json(input.snapshot.manifest),
    },
    git,
    diagnostics: input.snapshot.manifest.diagnostics,
    counts: {
      snapshotItems: input.snapshot.manifest.counts.item ?? 0,
      itemOverviewRows: countRows(sqlitePath, "item_overview_rows"),
      itemPresentationRows: countRows(sqlitePath, "item_presentation_rows"),
      itemOverviewFilters: countRows(sqlitePath, "item_overview_filters"),
      itemOverviewCategories: countRows(sqlitePath, "item_overview_categories"),
      statTypeOverviewRows: countRows(sqlitePath, "stat_type_overview_rows"),
      statTypePresentationRows: countRows(sqlitePath, "stat_type_presentation_rows"),
      itemCategoryOverviewRows: countRows(sqlitePath, "item_category_overview_rows"),
      itemCategoryPresentationRows: countRows(sqlitePath, "item_category_presentation_rows"),
      itemTagOverviewRows: countRows(sqlitePath, "item_tag_overview_rows"),
      itemTagPresentationRows: countRows(sqlitePath, "item_tag_presentation_rows"),
      entityNodes: countRows(sqlitePath, "entity_nodes"),
      entityAliases: countRows(sqlitePath, "entity_aliases"),
      entityEdges: countRows(sqlitePath, "entity_edges"),
      relationshipSections: countRows(sqlitePath, "entity_relationship_sections"),
      itemPresentationDiagnostics: countItemPresentationDiagnostics(sqlitePath),
      relationshipDiagnostics: countPipelineDiagnostics(sqlitePath, "relationship-graph"),
      richTextDiagnostics: countPipelineDiagnostics(sqlitePath, "rich-text"),
      assetRefs: input.assetsOutput.refs.length,
      webpAssets: uniqueAssetHashes.size,
    },
    outputs: {
      sqlite: {
        path: "data.sqlite",
        bytes: sqliteBytes,
        sha256: await sha256File(sqlitePath),
      },
      assets: {
        path: "assets",
        count: uniqueAssetHashes.size,
        treeSha256: await sha256Tree(assetsDir),
      },
    },
    probes: { items: probes },
  };
  if (!validateArtifactManifest(manifest)) {
    const detail = (validateArtifactManifest.errors ?? [])
      .map((error) => `artifact-manifest.json#${error.instancePath} — ${error.message}`)
      .join("\n");
    throw new Error(`invalid artifact manifest:\n${detail}`);
  }
  writeFileSync(
    join(input.artifactDir, "artifact-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return manifest;
}

function readItemProbes(sqlitePath: string): ArtifactManifest["probes"]["items"] {
  const db = new Database(sqlitePath, { readonly: true });
  try {
    return db
      .query(
        `SELECT o.id, o.name, n.canonical_slug AS canonicalSlug,
                o.display_icon_hash AS displayIconHash
         FROM item_overview_rows o
         JOIN entity_nodes n
           ON n.entity_type = 'item' AND n.entity_id = o.id AND n.has_page = 1
         WHERE o.name IS NOT NULL
         ORDER BY o.display_icon_hash IS NULL, o.name
         LIMIT 3`,
      )
      .all() as ArtifactManifest["probes"]["items"];
  } finally {
    db.close();
  }
}

function countRows(sqlitePath: string, table: string): number {
  const db = new Database(sqlitePath, { readonly: true });
  try {
    const tableRow = db
      .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(table);
    if (!tableRow) return 0;
    const row = db.query(`SELECT COUNT(*) AS count FROM ${table}`).get() as {
      count: number;
    } | null;
    return row?.count ?? 0;
  } finally {
    db.close();
  }
}

function writeArtifactMetadata(
  sqlitePath: string,
  values: {
    artifactKind: ArtifactManifest["artifactKind"];
    artifactId: string;
    sourceKind: ArtifactManifest["source"]["kind"];
    sourceSnapshotId: string;
    gitCommit: string;
  },
): void {
  const db = new Database(sqlitePath);
  try {
    db.exec(
      "CREATE TABLE IF NOT EXISTS artifact_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
    );
    const upsert = db.prepare(
      "INSERT INTO artifact_metadata (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    );
    upsert.run("schemaVersion", "1");
    upsert.run("artifactKind", values.artifactKind);
    upsert.run("artifactId", values.artifactId);
    upsert.run("sourceKind", values.sourceKind);
    upsert.run("sourceSnapshotId", values.sourceSnapshotId);
    upsert.run("gitCommit", values.gitCommit);
  } finally {
    db.close();
  }
}

function countPipelineDiagnostics(sqlitePath: string, source: string): number {
  const db = new Database(sqlitePath, { readonly: true });
  try {
    return (
      db
        .query<{ count: number }, [string]>(
          "SELECT COUNT(*) AS count FROM pipeline_diagnostics WHERE source = ?",
        )
        .get(source)?.count ?? 0
    );
  } finally {
    db.close();
  }
}

function countItemPresentationDiagnostics(sqlitePath: string): number {
  const db = new Database(sqlitePath, { readonly: true });
  try {
    const rows = db
      .query<{ diagnostics_json: string }, []>(
        "SELECT diagnostics_json FROM item_presentation_rows",
      )
      .all();
    return rows.reduce((count, row) => {
      const diagnostics = JSON.parse(row.diagnostics_json) as unknown[];
      return count + diagnostics.length;
    }, 0);
  } finally {
    db.close();
  }
}

function readGitIdentity(): ArtifactManifest["git"] {
  const commit = Bun.spawnSync(["git", "rev-parse", "HEAD"]).stdout.toString().trim();
  const branch =
    Bun.spawnSync(["git", "branch", "--show-current"]).stdout.toString().trim() || "detached";
  const status = Bun.spawnSync([
    "git",
    "status",
    "--porcelain",
    "--untracked-files=no",
  ]).stdout.toString();
  const remote = Bun.spawnSync(["git", "config", "--get", "remote.origin.url"])
    .stdout.toString()
    .trim();
  return {
    repository: remote.replace(/^https:\/\/github.com\//, "").replace(/\.git$/, ""),
    commit,
    branch,
    dirty: isTrackedWorktreeDirty(status),
  };
}

export function isTrackedWorktreeDirty(statusPorcelain: string): boolean {
  return statusPorcelain
    .split("\n")
    .filter((line) => line.length > 0)
    .some((line) => !line.startsWith("??"));
}
