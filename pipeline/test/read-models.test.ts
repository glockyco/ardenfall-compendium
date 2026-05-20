import { describe, it, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { buildDDL } from "$pipeline/sql/ddl";
import { canonicaliseItems } from "$pipeline/entities/item/canonicaliser";
import {
  emitItemReadModels,
  emitStatTypeReadModels,
  prepareEntityNodeWriter,
  emitItemCategoryReadModels,
  emitItemTagReadModels,
} from "$pipeline/stages/emit-read-models";
import { ENTITY_GRAPH_DDL } from "$pipeline/relationships/relationship-graph";
import { loadDescriptors } from "$pipeline/stages/load-descriptors";
import { loadSnapshot } from "$pipeline/stages/load-snapshot";
import { canonicaliseStatTypes } from "$pipeline/entities/stat-type/canonicaliser";
import { STAT_TYPE_DDL } from "$pipeline/sql/stat-type-ddl";
import { canonicaliseItemCategories } from "$pipeline/entities/item-category/canonicaliser";
import { ITEM_CATEGORY_DDL } from "$pipeline/sql/item-category-ddl";
import { canonicaliseItemTags } from "$pipeline/entities/item-tag/canonicaliser";
import { ITEM_TAG_DDL } from "$pipeline/sql/item-tag-ddl";

const ctx = {
  workspaceRoot: ".",
  snapshotDir: "fixtures/synthetic/snapshot",
  outDir: ".",
  log: () => undefined,
};

describe("emitItemReadModels", () => {
  it("builds item_overview_rows and item_presentation_rows without legacy fields_json", async () => {
    const desc = await loadDescriptors.run({}, ctx);
    const snap = await loadSnapshot.run({}, ctx);
    const itemEntity = desc.entities.item;
    const itemVariants = desc.variants.item;
    const itemEnvelope = snap.envelopes.item;
    if (!itemEntity || !itemVariants || !itemEnvelope) {
      throw new Error("fixture missing item entity/variants/envelope");
    }
    const db = new Database(":memory:");
    db.exec(buildDDL(itemEntity, itemVariants));
    canonicaliseItems(db, itemEntity, itemVariants, itemEnvelope);
    db.exec(`
      CREATE TABLE asset_refs (
        entity_id TEXT NOT NULL,
        entity_row_id TEXT NOT NULL,
        slot TEXT NOT NULL,
        asset_kind TEXT NOT NULL,
        asset_hash TEXT NOT NULL,
        PRIMARY KEY (entity_id, entity_row_id, slot)
      );
    `);
    db.run(
      "INSERT INTO asset_refs (entity_id, entity_row_id, slot, asset_kind, asset_hash) VALUES (?, ?, ?, ?, ?)",
      "item",
      "fixture-iron-sword",
      "displayIcon",
      "image",
      "a".repeat(64),
    );
    const iconMetadata = [
      {
        entityId: "item",
        rowId: "fixture-iron-sword",
        displayIconColor: { r: 1, g: 1, b: 1, a: 1 },
        secondaryIconColor: null,
      },
      {
        entityId: "item",
        rowId: "fixture-leather-tunic",
        displayIconColor: { r: 0.25, g: 0.2, b: 0.15, a: 1 },
        secondaryIconColor: null,
      },
    ];
    emitItemReadModels(db, desc, iconMetadata, itemEnvelope, snap.masterTooltip);

    const overview = db
      .query(
        "SELECT id, name, variant, display_icon_hash, display_icon_color FROM item_overview_rows ORDER BY name",
      )
      .all() as {
      id: string;
      name: string;
      variant: string;
      display_icon_hash: string | null;
      display_icon_color: string | null;
    }[];
    expect(overview.map((r) => r.name)).toEqual([
      "Fire Flask",
      "Iron Sword",
      "Leather Tunic",
      "Spark Slate",
      "Stamina Draught",
    ]);
    expect(overview.find((r) => r.id === "fixture-iron-sword")?.display_icon_hash).toBe(
      "a".repeat(64),
    );
    expect(overview.find((r) => r.id === "fixture-leather-tunic")?.display_icon_hash).toBeNull();
    expect(overview.find((r) => r.id === "fixture-iron-sword")?.display_icon_color).toBe(
      JSON.stringify({ r: 1, g: 1, b: 1, a: 1 }),
    );
    expect(overview.find((r) => r.id === "fixture-leather-tunic")?.display_icon_color).toBe(
      JSON.stringify({ r: 0.25, g: 0.2, b: 0.15, a: 1 }),
    );

    const legacyDetail = db
      .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'item_detail_rows'")
      .get();
    expect(legacyDetail).toBeNull();

    const presentationIcon = db
      .query(
        "SELECT display_icon_hash, display_icon_color FROM item_presentation_rows WHERE id = 'fixture-iron-sword'",
      )
      .get() as { display_icon_hash: string | null; display_icon_color: string | null };
    expect(presentationIcon.display_icon_hash).toBe("a".repeat(64));
    expect(presentationIcon.display_icon_color).toBe(JSON.stringify({ r: 1, g: 1, b: 1, a: 1 }));

    const presentation = db
      .query(
        "SELECT id, render_context, description_rich_text_json, stat_rows_json, effect_facts_json FROM item_presentation_rows WHERE id = 'fixture-stamina-draught'",
      )
      .get() as {
      id: string;
      render_context: string;
      description_rich_text_json: string;
      stat_rows_json: string;
      effect_facts_json: string;
    };
    expect(presentation.render_context).toBe("item-presentation-v1");
    const richDescription = JSON.parse(presentation.description_rich_text_json);
    expect(richDescription).toEqual(
      expect.objectContaining({
        schemaVersion: 1,
        nodes: expect.arrayContaining([expect.objectContaining({ type: "strong" })]),
      }),
    );
    expect(JSON.stringify(richDescription.nodes)).toContain("/terms/stamina");
    expect(JSON.parse(presentation.stat_rows_json)).toEqual([]);
    expect(JSON.parse(presentation.effect_facts_json)).toContainEqual(
      expect.objectContaining({ kind: "status-effect", label: "Status effects" }),
    );

    const variantSection = db
      .query(
        "SELECT title, edges_json FROM entity_relationship_sections WHERE source_type = 'item' AND source_id = 'fixture-iron-sword' AND predicate = 'variant_of'",
      )
      .get() as { title: string; edges_json: string };
    expect(variantSection.title).toBe("Variant");
    expect(JSON.parse(variantSection.edges_json)).toContainEqual(
      expect.objectContaining({
        targetType: "item-variant",
        targetId: "melee-weapon",
        targetRoutePath: "/items/variant/melee-weapon",
      }),
    );

    const termEdge = db
      .query(
        "SELECT target_type, target_id, predicate FROM entity_edges WHERE source_id = 'fixture-stamina-draught' AND predicate = 'references_term'",
      )
      .get() as { target_type: string; target_id: string; predicate: string };
    expect(termEdge).toEqual({
      target_type: "term",
      target_id: "stamina",
      predicate: "references_term",
    });

    const itemNode = db
      .query(
        "SELECT route_path, canonical_slug, short_id FROM entity_nodes WHERE entity_type = 'item' AND entity_id = 'fixture-iron-sword'",
      )
      .get() as { route_path: string; canonical_slug: string; short_id: string };
    expect(itemNode.route_path).toBe("/items/fixture-iron-sword");
    expect(itemNode.canonical_slug).toMatch(/^iron-sword--[0-9a-f]{8}$/);
    expect(itemNode.short_id).toMatch(/^[0-9a-f]{8}$/);

    const termNode = db
      .query(
        "SELECT route_path, canonical_slug, short_id FROM entity_nodes WHERE entity_type = 'term' AND entity_id = 'stamina'",
      )
      .get() as { route_path: string; canonical_slug: string; short_id: string };
    expect(termNode).toEqual({
      route_path: "/terms/stamina",
      canonical_slug: "stamina",
      short_id: "stamina",
    });

    expect(
      db
        .query(
          "SELECT count(*) AS count FROM pipeline_diagnostics WHERE source = 'relationship-graph'",
        )
        .get(),
    ).toEqual({ count: 0 });

    const categories = db
      .query(
        "SELECT category_id, label, href, item_count FROM item_overview_categories ORDER BY category_id",
      )
      .all() as { category_id: string; label: string; href: string; item_count: number }[];
    expect(categories).toContainEqual({
      category_id: "melee-weapon",
      label: "Melee Weapon",
      href: "/items/variant/melee-weapon",
      item_count: 1,
    });

    const variantFilter = db
      .query(
        "SELECT filter_id, kind, options_json FROM item_overview_filters WHERE filter_id = 'variant'",
      )
      .get() as { filter_id: string; kind: string; options_json: string };
    expect(variantFilter.kind).toBe("multi-select");
    expect(JSON.parse(variantFilter.options_json)).toContainEqual(
      expect.objectContaining({ value: "melee-weapon", label: "Melee Weapon", count: 1 }),
    );
  });
});

describe("emitStatTypeReadModels", () => {
  it("emits stat overview, presentation, and entity nodes", async () => {
    const snap = await loadSnapshot.run({}, ctx);
    const statEnvelope = snap.envelopes["stat-type"];
    if (!statEnvelope) throw new Error("fixture missing stat-type envelope");
    const db = new Database(":memory:");
    db.exec(ENTITY_GRAPH_DDL);
    db.exec(STAT_TYPE_DDL);
    db.exec(`
      CREATE TABLE asset_refs (
        entity_id TEXT NOT NULL,
        entity_row_id TEXT NOT NULL,
        slot TEXT NOT NULL,
        asset_kind TEXT NOT NULL,
        asset_hash TEXT NOT NULL,
        PRIMARY KEY (entity_id, entity_row_id, slot)
      );
    `);
    db.run(
      "INSERT INTO asset_refs (entity_id, entity_row_id, slot, asset_kind, asset_hash) VALUES (?, ?, ?, ?, ?)",
      "stat-type",
      "fixture-strength",
      "iconRef",
      "image",
      "b".repeat(64),
    );
    canonicaliseStatTypes(db, statEnvelope);

    emitStatTypeReadModels(db, snap.masterTooltip);

    const overview = db
      .query<
        { id: string; name: string; grouping: string; icon_hash: string | null },
        []
      >("SELECT id, name, grouping, icon_hash FROM stat_type_overview_rows ORDER BY name")
      .all();
    expect(overview).toEqual([
      { id: "fixture-heavy-armor", name: "Heavy Armor", grouping: "skill", icon_hash: null },
      {
        id: "fixture-strength",
        name: "Strength",
        grouping: "attribute",
        icon_hash: "b".repeat(64),
      },
    ]);

    const presentation = db
      .query<
        { render_context: string; icon_hash: string | null; affects_json: string },
        []
      >("SELECT render_context, icon_hash, affects_json FROM stat_type_presentation_rows WHERE id = 'fixture-strength'")
      .get();
    expect(presentation?.render_context).toBe("stat-type-presentation-v1");
    expect(presentation?.icon_hash).toBe("b".repeat(64));
    expect(JSON.parse(presentation?.affects_json ?? "[]")).toContain("melee-damage");

    const node = db
      .query<
        { route_path: string; canonical_slug: string; short_id: string },
        []
      >("SELECT route_path, canonical_slug, short_id FROM entity_nodes WHERE entity_type = 'stat-type' AND entity_id = 'fixture-strength'")
      .get();
    expect(node?.canonical_slug).toMatch(/^strength--[0-9a-f]{8}$/);
    expect(node?.route_path).toBe(`/stats/${node?.canonical_slug}`);
    expect(node?.short_id).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("emitItemCategoryReadModels", () => {
  it("emits category overview, presentation, item counts, and entity nodes", () => {
    const db = new Database(":memory:");
    db.exec(ENTITY_GRAPH_DDL);
    db.exec(ITEM_CATEGORY_DDL);
    db.exec(`
      CREATE TABLE items (
        id TEXT PRIMARY KEY,
        name TEXT,
        "categoryRef" TEXT,
        "categoryName" TEXT
      );
      CREATE TABLE asset_refs (
        entity_id TEXT NOT NULL,
        entity_row_id TEXT NOT NULL,
        slot TEXT NOT NULL,
        asset_kind TEXT NOT NULL,
        asset_hash TEXT NOT NULL,
        PRIMARY KEY (entity_id, entity_row_id, slot)
      );
    `);
    canonicaliseItemCategories(db, {
      entityId: "item-category",
      schemaVersion: 1,
      rows: [
        {
          id: "category-weapons",
          fields: {
            id: "category-weapons",
            categoryName: "Weapons",
            iconRef: null,
            defaultItemIconRef: { kind: "lookupAsset", guid: "default-icon-guid" },
            categoryColor: { r: 0.92, g: 0.42, b: 0.42, a: 1 },
            showInAllCategory: true,
            columns: [{ label: "Name", flexibleWidth: 2 }],
          },
        },
      ],
    });
    db.run(
      `INSERT INTO items (id, name, "categoryRef", "categoryName") VALUES (?, ?, ?, ?)`,
      "fixture-iron-sword",
      "Iron Sword",
      JSON.stringify({ kind: "lookupAsset", guid: "category-weapons" }),
      "Weapons",
    );
    db.run(
      `INSERT INTO items (id, name, "categoryRef", "categoryName") VALUES (?, ?, ?, ?)`,
      "fixture-training-dagger",
      "Training Dagger",
      JSON.stringify({ kind: "missing", reason: "lookupAssetGuidMissing" }),
      "Weapons",
    );
    db.run(
      "INSERT INTO asset_refs (entity_id, entity_row_id, slot, asset_kind, asset_hash) VALUES (?, ?, ?, ?, ?)",
      "item-category",
      "category-weapons",
      "defaultItemIconRef",
      "image",
      "c".repeat(64),
    );

    emitItemCategoryReadModels(db);

    const overview = db
      .query<
        {
          id: string;
          name: string;
          default_item_icon_hash: string | null;
          category_color_json: string;
          item_count: number;
        },
        []
      >(
        "SELECT id, name, default_item_icon_hash, category_color_json, item_count FROM item_category_overview_rows",
      )
      .get();
    expect(overview).toEqual({
      id: "category-weapons",
      name: "Weapons",
      default_item_icon_hash: "c".repeat(64),
      category_color_json: JSON.stringify({ r: 0.92, g: 0.42, b: 0.42, a: 1 }),
      item_count: 2,
    });

    const presentation = db
      .query<
        {
          render_context: string;
          columns_json: string;
          show_in_all_category: number;
          item_count: number;
        },
        []
      >(
        "SELECT render_context, columns_json, show_in_all_category, item_count FROM item_category_presentation_rows WHERE id = 'category-weapons'",
      )
      .get();
    expect(presentation?.render_context).toBe("item-category-presentation-v1");
    expect(JSON.parse(presentation?.columns_json ?? "[]")).toEqual([
      { label: "Name", flexibleWidth: 2 },
    ]);
    expect(presentation?.show_in_all_category).toBe(1);
    expect(presentation?.item_count).toBe(2);

    const node = db
      .query<
        { route_path: string; canonical_slug: string; short_id: string },
        []
      >("SELECT route_path, canonical_slug, short_id FROM entity_nodes WHERE entity_type = 'item-category' AND entity_id = 'category-weapons'")
      .get();
    expect(node?.canonical_slug).toMatch(/^weapons--[0-9a-f]{8}$/);
    expect(node?.route_path).toBe(`/categories/${node?.canonical_slug}`);
    expect(node?.short_id).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("emitItemTagReadModels", () => {
  it("emits tag overview, presentation, item counts, and entity nodes", () => {
    const db = new Database(":memory:");
    db.exec(ENTITY_GRAPH_DDL);
    db.exec(ITEM_TAG_DDL);
    db.exec(`
      CREATE TABLE item_overview_rows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        display_icon_hash TEXT,
        display_icon_color TEXT
      );
      CREATE TABLE item_tag_refs (
        item_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY (item_id, tag)
      );
    `);

    canonicaliseItemTags(db, {
      entityId: "item-tag",
      schemaVersion: 1,
      rows: [
        {
          id: "tag-valuable-remedy",
          fields: {
            id: "tag-valuable-remedy",
            tagName: "Valuable remedy",
            description: "Incredibly valuable remedy",
          },
        },
        {
          id: "tag-rare",
          fields: {
            id: "tag-rare",
            tagName: "Rare",
            description: "",
          },
        },
      ],
    });
    db.run(
      "INSERT INTO item_overview_rows (id, name, display_icon_hash, display_icon_color) VALUES (?, ?, ?, ?)",
      "fixture-stamina-draught",
      "Stamina Draught",
      null,
      null,
    );
    db.run(
      "INSERT INTO item_tag_refs (item_id, tag) VALUES (?, ?)",
      "fixture-stamina-draught",
      "tag-valuable-remedy",
    );

    emitItemTagReadModels(db);

    const overview = db
      .query<
        { id: string; name: string; description: string; item_count: number },
        []
      >("SELECT id, name, description, item_count FROM item_tag_overview_rows ORDER BY name")
      .all();
    expect(overview).toEqual([
      { id: "tag-rare", name: "Rare", description: "", item_count: 0 },
      {
        id: "tag-valuable-remedy",
        name: "Valuable remedy",
        description: "Incredibly valuable remedy",
        item_count: 1,
      },
    ]);

    const presentation = db
      .query<
        { render_context: string; description: string; item_count: number },
        []
      >("SELECT render_context, description, item_count FROM item_tag_presentation_rows WHERE id = 'tag-valuable-remedy'")
      .get();
    expect(presentation).toEqual({
      render_context: "item-tag-presentation-v1",
      description: "Incredibly valuable remedy",
      item_count: 1,
    });

    const node = db
      .query<
        { route_path: string; canonical_slug: string; short_id: string },
        []
      >("SELECT route_path, canonical_slug, short_id FROM entity_nodes WHERE entity_type = 'item-tag' AND entity_id = 'tag-valuable-remedy'")
      .get();
    expect(node?.canonical_slug).toMatch(/^valuable-remedy--[0-9a-f]{8}$/);
    expect(node?.route_path).toBe(`/tags/${node?.canonical_slug}`);
    expect(node?.short_id).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("prepareEntityNodeWriter", () => {
  it("inserts generic entity nodes with derived or explicit slugs", async () => {
    const db = new Database(":memory:");
    db.exec(ENTITY_GRAPH_DDL);

    const writeNode = prepareEntityNodeWriter(db);

    writeNode({
      entityType: "stat-type",
      entityId: "4ed202185a05d98439595e3fcab021c8.11400000",
      label: "Heavy Armor Skill",
      routePath: "/stats/heavy-armor-skill--4ed20218",
    });
    writeNode({
      entityType: "item-tag",
      entityId: "valuable-remedy",
      label: "Valuable Remedy",
      routePath: "/tags/valuable-remedy",
      canonicalSlug: "valuable-remedy",
      shortId: "valuable-remedy",
    });

    expect(
      db
        .query(
          "SELECT entity_type, entity_id, canonical_slug, short_id, is_public FROM entity_nodes ORDER BY entity_type",
        )
        .all(),
    ).toEqual([
      {
        entity_type: "item-tag",
        entity_id: "valuable-remedy",
        canonical_slug: "valuable-remedy",
        short_id: "valuable-remedy",
        is_public: 1,
      },
      {
        entity_type: "stat-type",
        entity_id: "4ed202185a05d98439595e3fcab021c8.11400000",
        canonical_slug: "heavy-armor-skill--4ed20218",
        short_id: "4ed20218",
        is_public: 1,
      },
    ]);
  });
});
