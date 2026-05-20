import { Database } from "bun:sqlite";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { buildArtifactManifest, isTrackedWorktreeDirty } from "../src/artifacts/manifest";
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
          redirectsOutput: { count: 0, filePath: join(root, "static", "_redirects") },
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
        CREATE TABLE item_presentation_rows (id TEXT PRIMARY KEY, diagnostics_json TEXT NOT NULL);
        INSERT INTO item_presentation_rows VALUES ('item-a', '[{"severity":"diagnostic","code":"fixture"}]');
        CREATE TABLE item_overview_filters (filter_id TEXT PRIMARY KEY);
        INSERT INTO item_overview_filters VALUES ('variant');
        CREATE TABLE item_overview_categories (category_id TEXT PRIMARY KEY);
        INSERT INTO item_overview_categories VALUES ('melee-weapon');
        CREATE TABLE entity_nodes (entity_type TEXT, entity_id TEXT);
        INSERT INTO entity_nodes VALUES ('item', 'item-a');
        CREATE TABLE entity_aliases (alias_key TEXT, target_type TEXT, target_id TEXT);
        INSERT INTO entity_aliases VALUES ('item-a', 'item', 'item-a');
        CREATE TABLE entity_edges (edge_id TEXT PRIMARY KEY);
        INSERT INTO entity_edges VALUES ('edge-a');
        CREATE TABLE entity_relationship_sections (section_id TEXT PRIMARY KEY);
        INSERT INTO entity_relationship_sections VALUES ('section-a');
        CREATE TABLE pipeline_diagnostics (source TEXT NOT NULL);
        INSERT INTO pipeline_diagnostics VALUES ('rich-text');
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
        redirectsOutput: { count: 2, filePath: join(root, "static", "_redirects") },
      });

      expect(manifest.artifactKind).toBe("release");
      expect(manifest.source.kind).toBe("live-game-export");
      expect(manifest.counts.itemOverviewRows).toBe(1);
      expect(manifest.counts.itemPresentationRows).toBe(1);
      expect(manifest.counts.itemOverviewFilters).toBe(1);
      expect(manifest.counts.itemOverviewCategories).toBe(1);
      expect(manifest.counts.entityNodes).toBe(1);
      expect(manifest.counts.entityAliases).toBe(1);
      expect(manifest.counts.entityEdges).toBe(1);
      expect(manifest.counts.relationshipSections).toBe(1);
      expect(manifest.counts.itemPresentationDiagnostics).toBe(1);
      expect(manifest.counts.relationshipDiagnostics).toBe(0);
      expect(manifest.counts.richTextDiagnostics).toBe(1);
      expect(manifest.counts.redirectsCount).toBe(2);
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

describe("git provenance", () => {
  it("does not mark release artifacts dirty for untracked local deploy state", () => {
    expect(isTrackedWorktreeDirty("?? site/.wrangler/state/v3/cache.sqlite\n")).toBe(false);
    expect(isTrackedWorktreeDirty(" M pipeline/src/artifacts/manifest.ts\n")).toBe(true);
    expect(isTrackedWorktreeDirty("M  site/package.json\n")).toBe(true);
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
    masterTooltip: {
      schemaVersion: 2,
      tooltipCodes: {},
      tooltipColors: {},
      tooltipTargetColor: { r: 1, g: 1, b: 1, a: 1 },
      tooltipDurationColor: { r: 1, g: 1, b: 1, a: 1 },
      positiveColor: { r: 0, g: 1, b: 0, a: 1 },
      negativeColor: { r: 1, g: 0, b: 0, a: 1 },
      spellSubEffectColor: { r: 1, g: 1, b: 1, a: 1 },
      enchantmentItemColor: { r: 1, g: 1, b: 1, a: 1 },
      primarySpellTooltip: "",
      secondarySpellTooltip: "",
      unmetSkillMessage: "",
      brokenDurabilityMessage: "",
      ruinedDurabilityMessage: "",
      statBookMessage: "",
      termSetColors: [],
      globalTermSets: [],
      termColorMatch: "\\b({0})\\b",
      potionRecipeDescription: "",
    },
  };
}
