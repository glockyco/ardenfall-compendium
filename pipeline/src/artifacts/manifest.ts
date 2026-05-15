import { Database } from "bun:sqlite";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { sha256File, sha256Json, sha256Tree } from "./hash";
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
  const manifest: ArtifactManifest = {
    schemaVersion: 1,
    artifactKind: input.artifactKind,
    artifactId: input.artifactId,
    createdAt: new Date().toISOString(),
    source: {
      kind: sourceKind,
      fixtureName:
        input.snapshot.manifest.source.kind === "synthetic-fixture"
          ? input.snapshot.manifest.source.fixtureName
          : undefined,
      snapshotId: `${input.snapshot.manifest.gameVersion ?? "unknown"}-${input.snapshot.manifest.buildIdentifier ?? "unknown"}`,
      gameVersion: input.snapshot.manifest.gameVersion ?? "unknown",
      buildIdentifier: input.snapshot.manifest.buildIdentifier ?? "unknown",
      extractorVersion: input.snapshot.manifest.extractorVersion,
      snapshotManifestSha256: sha256Json(input.snapshot.manifest),
    },
    git: readGitIdentity(),
    diagnostics: input.snapshot.manifest.diagnostics,
    counts: {
      snapshotItems: input.snapshot.manifest.counts.item ?? 0,
      itemOverviewRows: countRows(sqlitePath, "item_overview_rows"),
      itemDetailRows: countRows(sqlitePath, "item_detail_rows"),
      assetRefs: input.assetsOutput.refs.length,
      webpAssets: uniqueAssetHashes.size,
    },
    outputs: {
      sqlite: {
        path: "data.sqlite",
        bytes: input.sqliteOutput.byteSize,
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
        `SELECT id, name, display_icon_hash AS displayIconHash
         FROM item_overview_rows
         WHERE name IS NOT NULL
         ORDER BY display_icon_hash IS NULL, name
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

function readGitIdentity(): ArtifactManifest["git"] {
  const commit = Bun.spawnSync(["git", "rev-parse", "HEAD"]).stdout.toString().trim();
  const branch =
    Bun.spawnSync(["git", "branch", "--show-current"]).stdout.toString().trim() || "detached";
  const status = Bun.spawnSync(["git", "status", "--porcelain"]).stdout.toString();
  const remote = Bun.spawnSync(["git", "config", "--get", "remote.origin.url"])
    .stdout.toString()
    .trim();
  return {
    repository: remote.replace(/^https:\/\/github.com\//, "").replace(/\.git$/, ""),
    commit,
    branch,
    dirty: status.length > 0,
  };
}
