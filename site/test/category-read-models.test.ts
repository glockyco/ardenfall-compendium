import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const iconHash = "d".repeat(64);
const defaultIconHash = "e".repeat(64);
const categoryColor = JSON.stringify({ r: 0.92, g: 0.42, b: 0.42, a: 1 });
const richText = JSON.stringify({ schemaVersion: 1, sourceHash: "", nodes: [], diagnostics: [] });

describe("item-category read-model accessors", () => {
  it("lists category routes, resolves presentations, and lists category items", async () => {
    const originalCwd = process.cwd();
    const root = mkdtempSync(join(tmpdir(), "ardenfall-site-category-models-"));
    mkdirSync(join(root, ".data"), { recursive: true });
    const db = new Database(join(root, ".data", "data.sqlite"));
    db.exec(`
      CREATE TABLE item_category_overview_rows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon_hash TEXT,
        default_item_icon_hash TEXT,
        category_color_json TEXT NOT NULL,
        item_count INTEGER NOT NULL
      );
      CREATE TABLE item_category_presentation_rows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        render_context TEXT NOT NULL,
        icon_hash TEXT,
        default_item_icon_hash TEXT,
        category_color_json TEXT NOT NULL,
        show_in_all_category INTEGER NOT NULL,
        columns_json TEXT NOT NULL,
        item_count INTEGER NOT NULL
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
        value INTEGER,
        weight REAL,
        diagnostics_json TEXT NOT NULL
      );
      CREATE TABLE items (id TEXT PRIMARY KEY, "categoryRef" TEXT, "categoryName" TEXT);
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
      CREATE TABLE entity_edges (
        edge_id TEXT PRIMARY KEY,
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        predicate TEXT NOT NULL,
        label TEXT NOT NULL,
        weight REAL NOT NULL,
        evidence_json TEXT NOT NULL,
        anchor TEXT
      );
      INSERT INTO item_category_overview_rows VALUES
        ('named;item-category;itemcat_weapons', 'Weapons', '${iconHash}', '${defaultIconHash}', '${categoryColor}', 1);
      INSERT INTO item_category_presentation_rows VALUES
        ('named;item-category;itemcat_weapons', 'Weapons', 'item-category-presentation-v1', '${iconHash}', '${defaultIconHash}', '${categoryColor}', 1, '[{"label":"Name"}]', 1);
      INSERT INTO item_overview_rows VALUES
        ('4ed20218.fixture-iron-sword', 'Iron Sword', 3.5, 25, 'melee-weapon', '${iconHash}', '${categoryColor}'),
        ('fixture-training-dagger', 'Training Dagger', 1.5, 5, 'melee-weapon', '${iconHash}', '${categoryColor}');
      INSERT INTO item_presentation_rows VALUES
        ('4ed20218.fixture-iron-sword', 'Iron Sword', 'melee-weapon', 'Melee weapon', 'item-presentation-v1', '${iconHash}', '${categoryColor}', '', '${richText}', '', '${richText}', '[]', '[]', '[]', NULL, '[]', 25, 3.5, '[]');
      INSERT INTO items VALUES
        ('4ed20218.fixture-iron-sword', '{"kind":"namedAsset","entity":"item-category","name":"itemcat_weapons"}', 'Weapons'),
        ('fixture-training-dagger', '{"kind":"missing","reason":"lookupAssetGuidMissing"}', 'Weapons');
      INSERT INTO entity_nodes VALUES
        ('item-category', 'named;item-category;itemcat_weapons', 'Weapons', '/categories/weapons--abc12345', 'weapons--abc12345', 'abc12345', 1),
        ('item', '4ed20218.fixture-iron-sword', 'Iron Sword', '/items/4ed20218.fixture-iron-sword', 'iron-sword--4ed20218', '4ed20218', 1),
        ('item', 'fixture-training-dagger', 'Training Dagger', '/items/fixture-training-dagger', 'training-dagger--fbfb0000', 'fbfb0000', 1);
      INSERT INTO entity_edges VALUES
        ('4ed20218.fixture-iron-sword:categorised_as:item-category:named;item-category;itemcat_weapons',
         'item', '4ed20218.fixture-iron-sword', 'item-category',
         'named;item-category;itemcat_weapons', 'categorised_as', 'Category', 1,
         '{"source":"items.categoryRef"}', NULL);
    `);

    try {
      process.chdir(root);
      const readModels = await import("../src/lib/server/read-models");

      expect(readModels.listItemCategories()).toEqual([
        {
          id: "named;item-category;itemcat_weapons",
          name: "Weapons",
          iconSrc: `/assets/${iconHash}.webp`,
          defaultItemIconSrc: `/assets/${defaultIconHash}.webp`,
          categoryColor,
          itemCount: 1,
          routePath: "/categories/weapons--abc12345",
        },
      ]);
      expect(readModels.getItemCategoryPresentation("weapons--abc12345")).toEqual({
        id: "named;item-category;itemcat_weapons",
        name: "Weapons",
        renderContext: "item-category-presentation-v1",
        iconSrc: `/assets/${iconHash}.webp`,
        defaultItemIconSrc: `/assets/${defaultIconHash}.webp`,
        categoryColor,
        showInAllCategory: true,
        columns: [{ label: "Name" }],
        itemCount: 1,
        routePath: "/categories/weapons--abc12345",
      });
      expect(readModels.listCategoriesForItem("4ed20218.fixture-iron-sword")).toEqual([
        {
          targetType: "item-category",
          targetId: "named;item-category;itemcat_weapons",
          targetLabel: "Weapons",
          targetRoutePath: "/categories/weapons--abc12345",
          predicate: "categorised_as",
          label: "Category",
          weight: 1,
          anchor: null,
        },
      ]);
      expect(readModels.listCategoriesForItem("fixture-training-dagger")).toEqual([]);
    } finally {
      process.chdir(originalCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });
});
