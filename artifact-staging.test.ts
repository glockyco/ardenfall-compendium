import { Database } from "bun:sqlite";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { buildArtifactManifest } from "./pipeline/src/artifacts/manifest.ts";
import { stageArtifact } from "./site/scripts/stage-artifact.ts";
import type { LoadSnapshotOutput } from "./pipeline/src/stages/load-snapshot.ts";

/**
 * Artifact staging is the gate between a manipulated artifact and a deploy, and
 * it spans two packages: the pipeline writes the artifact and manifest, the site
 * script validates them. That makes these tests cross-package, so they live in
 * the root project rather than inside either package, whose `rootDir` correctly
 * forbids reaching across the boundary.
 */
describe("artifact staging rejects tampering", () => {
  it("rejects a tampered hashed file and names data.sqlite", async () => {
    const root = mkdtempSync(join(tmpdir(), "ardenfall-artifact-manifest-"));
    try {
      await createValidArtifact(root);
      const sqlitePath = join(root, "data.sqlite");
      writeFileSync(sqlitePath, Buffer.concat([readFileSync(sqlitePath), Buffer.from("tampered")]));

      await expect(
        stageArtifact({ artifactDir: root, targetDir: join(root, "staged"), mode: "release" }),
      ).rejects.toThrow(/artifact file (?:size|hash) mismatch for .*data\.sqlite/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a tampered recorded row count", async () => {
    const root = mkdtempSync(join(tmpdir(), "ardenfall-artifact-manifest-"));
    try {
      await createValidArtifact(root);
      const manifestPath = join(root, "artifact-manifest.json");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      manifest.counts.itemOverviewRows += 1;
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

      await expect(
        stageArtifact({ artifactDir: root, targetDir: join(root, "staged"), mode: "release" }),
      ).rejects.toThrow(/itemOverviewRows mismatch: expected 2, got 1/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a missing file listed by the manifest", async () => {
    const root = mkdtempSync(join(tmpdir(), "ardenfall-artifact-manifest-"));
    try {
      await createValidArtifact(root);
      rmSync(join(root, "assets", `${"a".repeat(64)}.webp`));

      await expect(
        stageArtifact({ artifactDir: root, targetDir: join(root, "staged"), mode: "release" }),
      ).rejects.toThrow(/asset tree hash mismatch/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("accepts an untampered artifact", async () => {
    const root = mkdtempSync(join(tmpdir(), "ardenfall-artifact-manifest-"));
    try {
      await createValidArtifact(root);

      await expect(
        stageArtifact({ artifactDir: root, targetDir: join(root, "staged"), mode: "release" }),
      ).resolves.toMatchObject({ manifest: { artifactKind: "release" } });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

async function createValidArtifact(root: string) {
  mkdirSync(join(root, "assets"), { recursive: true });
  mkdirSync(join(root, "static"), { recursive: true });
  const assetPath = join(root, "assets", `${"a".repeat(64)}.webp`);
  writeFileSync(assetPath, "asset bytes");
  writeFileSync(join(root, "static", "_redirects"), "# redirects\n");

  const db = new Database(join(root, "data.sqlite"));
  db.exec(`
    CREATE TABLE item_overview_rows (id TEXT PRIMARY KEY, name TEXT, display_icon_hash TEXT);
    INSERT INTO item_overview_rows VALUES ('item-a', 'Item A', '${"a".repeat(64)}');
    CREATE TABLE item_presentation_rows (id TEXT PRIMARY KEY, diagnostics_json TEXT NOT NULL);
    INSERT INTO item_presentation_rows VALUES ('item-a', '[]');
    CREATE TABLE item_overview_filters (filter_id TEXT PRIMARY KEY);
    CREATE TABLE item_overview_categories (category_id TEXT PRIMARY KEY);
    CREATE TABLE stat_type_overview_rows (id TEXT PRIMARY KEY);
    CREATE TABLE stat_type_presentation_rows (id TEXT PRIMARY KEY);
    CREATE TABLE item_category_overview_rows (id TEXT PRIMARY KEY);
    CREATE TABLE item_category_presentation_rows (id TEXT PRIMARY KEY);
    CREATE TABLE item_tag_overview_rows (id TEXT PRIMARY KEY);
    CREATE TABLE item_tag_presentation_rows (id TEXT PRIMARY KEY);
    CREATE TABLE entity_nodes (entity_type TEXT, entity_id TEXT);
    CREATE TABLE entity_aliases (alias_key TEXT, target_type TEXT, target_id TEXT);
    CREATE TABLE entity_edges (edge_id TEXT PRIMARY KEY);
    CREATE TABLE entity_relationship_sections (section_id TEXT PRIMARY KEY);
    CREATE TABLE pipeline_diagnostics (source TEXT NOT NULL);
  `);
  db.close();

  return buildArtifactManifest({
    artifactKind: "release",
    artifactId: "tamper-test",
    artifactDir: root,
    snapshot: liveExportSnapshot(),
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
          outputPath: assetPath,
        },
      ],
      itemIconMetadata: [],
    },
    redirectsOutput: { count: 0, filePath: join(root, "static", "_redirects") },
  });
}

/** Minimal live-export snapshot, the only shape these staging tests need. */
function liveExportSnapshot(): LoadSnapshotOutput {
  return {
    manifest: {
      schemaVersion: 1,
      source: { kind: "live-game-export" },
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
    finalizeTimings: [],
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
      allAttributes: [],
      allSkills: [],
      allTraits: [],
    },
  };
}
