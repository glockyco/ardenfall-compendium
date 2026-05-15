import { Database } from "bun:sqlite";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { buildArtifactManifest } from "../src/artifacts/manifest";
import type { LoadSnapshotOutput } from "../src/stages/load-snapshot";

describe("artifact manifest emission", () => {
  it("refuses to build a release artifact from a synthetic fixture snapshot", async () => {
    const root = mkdtempSync(join(tmpdir(), "ardenfall-artifact-manifest-"));
    try {
      const snapshot = fixtureSnapshot("synthetic-fixture");
      await expect(
        buildArtifactManifest({
          artifactKind: "release",
          artifactId: "bad-release",
          artifactDir: root,
          snapshot,
          sqliteOutput: { outputPath: join(root, "data.sqlite"), byteSize: 1 },
          assetsOutput: { assetsDir: join(root, "assets"), refs: [], itemIconMetadata: [] },
        }),
      ).rejects.toThrow(/release artifacts require live-game-export snapshots/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("emits release manifest identity, hashes, counts, and probes", async () => {
    const root = mkdtempSync(join(tmpdir(), "ardenfall-artifact-manifest-"));
    try {
      mkdirSync(join(root, "assets"), { recursive: true });
      writeFileSync(join(root, "assets", "a".repeat(64) + ".webp"), "asset bytes");
      const db = new Database(join(root, "data.sqlite"));
      db.exec(`
        CREATE TABLE item_overview_rows (id TEXT PRIMARY KEY, name TEXT, display_icon_hash TEXT);
        INSERT INTO item_overview_rows VALUES ('item-a', 'Item A', '${"a".repeat(64)}');
      `);
      db.close();

      const manifest = await buildArtifactManifest({
        artifactKind: "release",
        artifactId: "0.0.10.91-run-a",
        artifactDir: root,
        snapshot: fixtureSnapshot("live-game-export"),
        sqliteOutput: {
          outputPath: join(root, "data.sqlite"),
          byteSize: Bun.file(join(root, "data.sqlite")).size,
        },
        assetsOutput: {
          assetsDir: join(root, "assets"),
          refs: [
            {
              entityId: "item",
              entityRowId: "item-a",
              slot: "displayIcon",
              assetKind: "image",
              assetHash: "a".repeat(64),
              outputPath: join(root, "assets", "a".repeat(64) + ".webp"),
            },
          ],
          itemIconMetadata: [],
        },
      });

      expect(manifest.artifactKind).toBe("release");
      expect(manifest.source.kind).toBe("live-game-export");
      expect(manifest.counts.itemOverviewRows).toBe(1);
      expect(manifest.outputs.sqlite.bytes).toBeGreaterThan(0);
      expect(manifest.probes.items).toEqual([
        { id: "item-a", name: "Item A", displayIconHash: "a".repeat(64) },
      ]);

      const metadataDb = new Database(join(root, "data.sqlite"), { readonly: true });
      try {
        const metadata = metadataDb
          .query("SELECT key, value FROM artifact_metadata ORDER BY key")
          .all() as { key: string; value: string }[];
        expect(metadata).toContainEqual({ key: "artifactKind", value: "release" });
        expect(metadata).toContainEqual({ key: "artifactId", value: "0.0.10.91-run-a" });
        expect(metadata).toContainEqual({ key: "sourceKind", value: "live-game-export" });
        expect(metadata.find((row) => row.key === "gitCommit")?.value).toMatch(/^[a-f0-9]{40}$/);
      } finally {
        metadataDb.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

function fixtureSnapshot(kind: "live-game-export" | "synthetic-fixture"): LoadSnapshotOutput {
  return {
    manifest: {
      schemaVersion: 1,
      source: kind === "live-game-export" ? { kind } : { kind, fixtureName: "synthetic" },
      gameVersion: "0.0.10.91",
      buildIdentifier: "run-a",
      extractorVersion: "0.1.0",
      extractedAt: "2026-05-15T00:00:00.000Z",
      preflight: { passed: true, completedAt: "2026-05-15T00:00:00.000Z", checks: [] },
      counts: { item: 1 },
      diagnostics: { fatal: 0, diagnostic: 0 },
      hashes: { "items.json": "b".repeat(64) },
    },
    envelopes: {},
    diagnostics: [],
  };
}
