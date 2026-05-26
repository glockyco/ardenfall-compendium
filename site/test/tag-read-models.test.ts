import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const richText = JSON.stringify({ schemaVersion: 1, sourceHash: "", nodes: [], diagnostics: [] });

describe("item-tag read-model accessors", () => {
  it("lists tag routes, resolves presentations, and lists tagged items", async () => {
    const originalCwd = process.cwd();
    const root = join(tmpdir(), `ardenfall-site-tag-models-${process.pid}-${Date.now()}`);
    mkdirSync(join(root, "static"), { recursive: true });
    const db = new Database(join(root, "static", "data.sqlite"));
    db.exec(`
      CREATE TABLE item_tag_overview_rows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        item_count INTEGER NOT NULL
      );
      CREATE TABLE item_tag_presentation_rows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        render_context TEXT NOT NULL,
        description TEXT NOT NULL,
        item_count INTEGER NOT NULL
      );
      CREATE TABLE item_tag_refs (
        item_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY (item_id, tag)
      );
      CREATE TABLE item_overview_rows (
        id TEXT PRIMARY KEY,
        name TEXT,
        weight REAL,
        value INTEGER,
        variant TEXT,
        display_icon_hash TEXT,
        display_icon_color TEXT
      );
      CREATE TABLE item_presentation_rows (
        id TEXT PRIMARY KEY,
        name TEXT,
        variant TEXT,
        item_type TEXT,
        render_context TEXT NOT NULL,
        display_icon_hash TEXT,
        display_icon_color TEXT,
        description_source TEXT NOT NULL,
        description_rich_text_json TEXT NOT NULL,
        effects_source TEXT NOT NULL,
        effects_source_rich_text_json TEXT NOT NULL,
        effect_facts_json TEXT NOT NULL,
        stat_rows_json TEXT NOT NULL,
        requirements_json TEXT NOT NULL,
        durability_json TEXT,
        state_facts_json TEXT NOT NULL,
        omissions_json TEXT NOT NULL,
        value INTEGER,
        weight REAL,
        diagnostics_json TEXT NOT NULL
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
      INSERT INTO item_tag_overview_rows VALUES
        ('7a600001.fixture-tag-valuable-remedy', 'Valuable remedy', 'Incredibly valuable remedy', 1),
        ('7a600002.fixture-tag-rare', 'Rare', 'Difficult to find.', 0);
      INSERT INTO item_tag_presentation_rows VALUES
        ('7a600001.fixture-tag-valuable-remedy', 'Valuable remedy', 'item-tag-presentation-v1', 'Incredibly valuable remedy', 1),
        ('7a600002.fixture-tag-rare', 'Rare', 'item-tag-presentation-v1', 'Difficult to find.', 0);
      INSERT INTO item_overview_rows VALUES
        ('6a71c0de.fixture-stamina-draught', 'Stamina Draught', 0.25, 9, 'consumable', NULL, NULL);
      INSERT INTO item_presentation_rows VALUES
        ('6a71c0de.fixture-stamina-draught', 'Stamina Draught', 'consumable', 'Consumable', 'item-presentation-v1', NULL, NULL, '', '${richText}', '', '${richText}', '[]', '[]', '[]', NULL, '[]', '[]', 9, 0.25, '[]');
      INSERT INTO item_tag_refs VALUES
        ('6a71c0de.fixture-stamina-draught', '7a600001.fixture-tag-valuable-remedy');
      INSERT INTO entity_nodes VALUES
        ('item-tag', '7a600001.fixture-tag-valuable-remedy', 'Valuable remedy', '/tags/valuable-remedy--abc12345', 'valuable-remedy--abc12345', 'abc12345', 1),
        ('item-tag', '7a600002.fixture-tag-rare', 'Rare', '/tags/rare--def67890', 'rare--def67890', 'def67890', 1),
        ('item', '6a71c0de.fixture-stamina-draught', 'Stamina Draught', '/items/6a71c0de.fixture-stamina-draught', 'stamina-draught--6a71c0de', '6a71c0de', 1);
    `);
    db.close();

    try {
      process.chdir(root);
      const readModels = await import("../src/lib/server/read-models");

      expect(readModels.listItemTags()).toEqual([
        {
          id: "7a600002.fixture-tag-rare",
          name: "Rare",
          description: "Difficult to find.",
          itemCount: 0,
          routePath: "/tags/rare--def67890",
        },
        {
          id: "7a600001.fixture-tag-valuable-remedy",
          name: "Valuable remedy",
          description: "Incredibly valuable remedy",
          itemCount: 1,
          routePath: "/tags/valuable-remedy--abc12345",
        },
      ]);
      expect(readModels.getItemTagPresentation("valuable-remedy--abc12345")).toEqual({
        id: "7a600001.fixture-tag-valuable-remedy",
        name: "Valuable remedy",
        renderContext: "item-tag-presentation-v1",
        description: "Incredibly valuable remedy",
        itemCount: 1,
      });
      expect(
        readModels.listItemsByTag("7a600001.fixture-tag-valuable-remedy").map((row) => row.id),
      ).toEqual(["6a71c0de.fixture-stamina-draught"]);
    } finally {
      process.chdir(originalCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });
});
