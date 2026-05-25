import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const iconHash = "c".repeat(64);

describe("stat read-model accessors", () => {
  it("lists stat routes and resolves presentation rows by canonical slug", async () => {
    const originalCwd = process.cwd();
    const root = join(tmpdir(), `ardenfall-site-stat-models-${process.pid}-${Date.now()}`);
    mkdirSync(join(root, "static"), { recursive: true });
    const db = new Database(join(root, "static", "data.sqlite"));
    db.exec(`
      CREATE TABLE stat_type_overview_rows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        grouping TEXT NOT NULL,
        icon_hash TEXT,
        icon_color TEXT
      );
      CREATE TABLE stat_type_presentation_rows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        grouping TEXT NOT NULL,
        render_context TEXT NOT NULL,
        icon_hash TEXT,
        icon_color TEXT,
        description TEXT,
        long_description TEXT,
        affects_json TEXT NOT NULL,
        skill_affects_json TEXT NOT NULL
      );
      CREATE TABLE entity_nodes (
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        label TEXT NOT NULL,
        route_path TEXT NOT NULL,
        canonical_slug TEXT NOT NULL,
        short_id TEXT NOT NULL,
        is_public INTEGER NOT NULL,
        PRIMARY KEY (entity_type, entity_id)
      );
      INSERT INTO stat_type_overview_rows VALUES
        ('57a70001.fixture-strength', 'Strength', 'attribute', '${iconHash}', '{"r":1,"g":0.5,"b":0.25,"a":1}'),
        ('57a70002.fixture-heavy-armor', 'Heavy Armor', 'skill', NULL, NULL);
      INSERT INTO stat_type_presentation_rows VALUES
        ('57a70001.fixture-strength', 'Strength', 'attribute', 'stat-type-presentation-v1', '${iconHash}', '{"r":1,"g":0.5,"b":0.25,"a":1}', 'Raw power.', 'Raw power. Affects melee damage.', '["melee-damage"]', '["57a70002.fixture-heavy-armor"]');
      INSERT INTO entity_nodes VALUES
        ('stat-type', '57a70001.fixture-strength', 'Strength', '/stats/strength--abc12345', 'strength--abc12345', 'abc12345', 1),
        ('stat-type', '57a70002.fixture-heavy-armor', 'Heavy Armor', '/stats/heavy-armor--def67890', 'heavy-armor--def67890', 'def67890', 1);
    `);
    db.close();

    try {
      process.chdir(root);
      const readModels = await import("../src/lib/server/read-models");

      expect(readModels.listStatTypes()).toEqual([
        {
          id: "57a70001.fixture-strength",
          name: "Strength",
          grouping: "attribute",
          iconSrc: `/assets/${iconHash}.webp`,
          iconColor: "rgba(255, 128, 64, 1)",
          routePath: "/stats/strength--abc12345",
        },
        {
          id: "57a70002.fixture-heavy-armor",
          name: "Heavy Armor",
          grouping: "skill",
          iconSrc: null,
          iconColor: null,
          routePath: "/stats/heavy-armor--def67890",
        },
      ]);
      expect(readModels.getStatTypePresentation("strength--abc12345")).toEqual({
        id: "57a70001.fixture-strength",
        name: "Strength",
        grouping: "attribute",
        renderContext: "stat-type-presentation-v1",
        iconSrc: `/assets/${iconHash}.webp`,
        iconColor: "rgba(255, 128, 64, 1)",
        description: "Raw power.",
        longDescription: "Raw power. Affects melee damage.",
        affects: ["melee-damage"],
        skillAffects: ["57a70002.fixture-heavy-armor"],
      });
      expect(readModels.getStatTypePresentation("missing--00000000")).toBeUndefined();
    } finally {
      process.chdir(originalCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails on malformed generated color JSON", async () => {
    const originalCwd = process.cwd();
    const root = join(tmpdir(), `ardenfall-site-stat-color-${process.pid}-${Date.now()}`);
    mkdirSync(join(root, "static"), { recursive: true });
    const db = new Database(join(root, "static", "data.sqlite"));
    db.exec(`
      CREATE TABLE stat_type_overview_rows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        grouping TEXT NOT NULL,
        icon_hash TEXT,
        icon_color TEXT
      );
      CREATE TABLE entity_nodes (
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        label TEXT NOT NULL,
        route_path TEXT NOT NULL,
        canonical_slug TEXT NOT NULL,
        short_id TEXT NOT NULL,
        is_public INTEGER NOT NULL,
        PRIMARY KEY (entity_type, entity_id)
      );
      INSERT INTO stat_type_overview_rows VALUES
        ('57a70001.fixture-strength', 'Strength', 'attribute', NULL, '{"r":"bad"}');
      INSERT INTO entity_nodes VALUES
        ('stat-type', '57a70001.fixture-strength', 'Strength', '/stats/strength--abc12345', 'strength--abc12345', 'abc12345', 1);
    `);
    db.close();

    try {
      process.chdir(root);
      const readModels = await import("../src/lib/server/read-models");

      expect(() => readModels.listStatTypes()).toThrow(/invalid generated color/);
    } finally {
      process.chdir(originalCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });
});
