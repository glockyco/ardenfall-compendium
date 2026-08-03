import { describe, it, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { buildDDL } from "$pipeline/sql/ddl";
import { canonicaliseItems } from "$pipeline/entities/item/canonicaliser";
import { emitItemReadModels, prepareEntityNodeWriter } from "$pipeline/entities/item/read-models";
import { emitStatTypeReadModels } from "$pipeline/entities/stat-type/read-models";
import { emitItemCategoryReadModels } from "$pipeline/entities/item-category/read-models";
import { emitItemTagReadModels } from "$pipeline/entities/item-tag/read-models";
import { ENTITY_GRAPH_DDL } from "$pipeline/relationships/relationship-graph";
import { loadDescriptors } from "$pipeline/stages/load-descriptors";
import { loadSnapshot } from "$pipeline/stages/load-snapshot";
import { canonicaliseStatTypes } from "$pipeline/entities/stat-type/canonicaliser";
import { STAT_TYPE_DDL } from "$pipeline/sql/stat-type-ddl";
import { canonicaliseItemCategories } from "$pipeline/entities/item-category/canonicaliser";
import { ITEM_CATEGORY_DDL } from "$pipeline/sql/item-category-ddl";
import { canonicaliseItemTags } from "$pipeline/entities/item-tag/canonicaliser";
import { ITEM_TAG_DDL } from "$pipeline/sql/item-tag-ddl";
import { canonicaliseLocations } from "$pipeline/entities/location/canonicaliser";
import { LOCATION_DDL } from "$pipeline/sql/location-ddl";
import { emitMapReadModels } from "$pipeline/map/read-models";
import { PORTAL_DDL } from "$pipeline/sql/portal-ddl";
import { SPELL_DDL } from "$pipeline/sql/spell-ddl";
import { canonicalisePortals } from "$pipeline/entities/portal/canonicaliser";
import { emitPortalReadModels } from "$pipeline/entities/portal/read-models";

const ctx = {
  workspaceRoot: ".",
  snapshotDir: "fixtures/synthetic/snapshot",
  outDir: ".",
  log: () => undefined,
};

describe("prepareEntityNodeWriter", () => {
  it("fails instead of hashing malformed asset ids into public slugs", () => {
    const db = new Database(":memory:");
    db.exec(ENTITY_GRAPH_DDL);
    const writeNode = prepareEntityNodeWriter(db);

    expect(() =>
      writeNode({
        entityType: "item",
        entityId: "fixture-iron-sword",
        label: "Iron Sword",
        routePath: "/items/fixture-iron-sword",
      }),
    ).toThrow(/cannot derive short_id/);
  });
});
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
    const itemCategoryEnvelope = snap.envelopes["item-category"];
    const itemTagEnvelope = snap.envelopes["item-tag"];
    if (!itemCategoryEnvelope || !itemTagEnvelope) {
      throw new Error("fixture missing item category/tag envelopes");
    }
    db.exec(ITEM_CATEGORY_DDL);
    db.exec(ITEM_TAG_DDL);
    canonicaliseItemCategories(db, itemCategoryEnvelope);
    canonicaliseItemTags(db, itemTagEnvelope);
    db.exec(`
      CREATE TABLE status_effects (id TEXT PRIMARY KEY);
      INSERT INTO status_effects (id) VALUES
        ('91a00001.fixture-status-effect-bleeding'),
        ('91a00002.fixture-status-effect-burning');
    `);
    db.exec(SPELL_DDL);
    db.exec(`
      INSERT INTO spells (id, spell_name) VALUES
        ('named;spell;spell_fire-shield', 'Fire Shield'),
        ('named;spell;spell_arcane-surge', 'Arcane Surge');
    `);

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
      ["item", "4ed20218.fixture-iron-sword", "displayIcon", "image", "a".repeat(64)],
    );
    const iconMetadata = [
      {
        entityId: "item",
        rowId: "4ed20218.fixture-iron-sword",
        displayIconColor: { r: 1, g: 1, b: 1, a: 1 },
        secondaryIconColor: null,
      },
      {
        entityId: "item",
        rowId: "5ea7beef.fixture-leather-tunic",
        displayIconColor: { r: 0.25, g: 0.2, b: 0.15, a: 1 },
        secondaryIconColor: null,
      },
    ];
    if (itemEntity.site) itemEntity.site.route = "/objects";
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
    expect(overview.find((r) => r.id === "4ed20218.fixture-iron-sword")?.display_icon_hash).toBe(
      "a".repeat(64),
    );
    expect(
      overview.find((r) => r.id === "5ea7beef.fixture-leather-tunic")?.display_icon_hash,
    ).toBeNull();
    expect(overview.find((r) => r.id === "4ed20218.fixture-iron-sword")?.display_icon_color).toBe(
      JSON.stringify({ r: 1, g: 1, b: 1, a: 1 }),
    );
    expect(
      overview.find((r) => r.id === "5ea7beef.fixture-leather-tunic")?.display_icon_color,
    ).toBe(JSON.stringify({ r: 0.25, g: 0.2, b: 0.15, a: 1 }));

    const legacyDetail = db
      .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'item_detail_rows'")
      .get();
    expect(legacyDetail).toBeNull();

    const presentationIcon = db
      .query(
        "SELECT display_icon_hash, display_icon_color FROM item_presentation_rows WHERE id = '4ed20218.fixture-iron-sword'",
      )
      .get() as { display_icon_hash: string | null; display_icon_color: string | null };
    expect(presentationIcon.display_icon_hash).toBe("a".repeat(64));
    expect(presentationIcon.display_icon_color).toBe(JSON.stringify({ r: 1, g: 1, b: 1, a: 1 }));

    const presentation = db
      .query(
        "SELECT id, render_context, description_rich_text_json, stat_rows_json, effect_facts_json, diagnostics_json FROM item_presentation_rows WHERE id = '6a71c0de.fixture-stamina-draught'",
      )
      .get() as {
      id: string;
      render_context: string;
      description_rich_text_json: string;
      stat_rows_json: string;
      effect_facts_json: string;
      diagnostics_json: string;
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
    const statusFacts = JSON.parse(presentation.effect_facts_json) as {
      targetId: string | null;
      level: number | null;
    }[];
    expect(statusFacts).toEqual([
      expect.objectContaining({
        targetId: "91a00001.fixture-status-effect-bleeding",
        level: 1,
      }),
      expect.objectContaining({
        targetId: "91a00002.fixture-status-effect-burning",
        level: 2.5,
      }),
    ]);
    const appliesEdges = db
      .query(
        `SELECT edge_id, target_id, predicate, label, evidence_json
         FROM entity_edges
         WHERE source_id = '6a71c0de.fixture-stamina-draught' AND predicate = 'applies'
         ORDER BY edge_id`,
      )
      .all() as {
      edge_id: string;
      target_id: string;
      predicate: string;
      label: string;
      evidence_json: string;
    }[];
    expect(appliesEdges).toHaveLength(2);
    expect(appliesEdges).toEqual([
      expect.objectContaining({
        edge_id:
          "6a71c0de.fixture-stamina-draught:applies:status-effect:91a00001.fixture-status-effect-bleeding",
        target_id: "91a00001.fixture-status-effect-bleeding",
        predicate: "applies",
        label: "Applies",
      }),
      expect.objectContaining({
        edge_id:
          "6a71c0de.fixture-stamina-draught:applies:status-effect:91a00002.fixture-status-effect-burning",
        target_id: "91a00002.fixture-status-effect-burning",
        predicate: "applies",
        label: "Applies",
      }),
    ]);
    expect(JSON.parse(appliesEdges[0]!.evidence_json)).toEqual({
      source: "items.statusEffectsJson",
      level: 1,
    });
    expect(JSON.parse(appliesEdges[1]!.evidence_json)).toEqual({
      source: "items.statusEffectsJson",
      level: 2.5,
    });
    const slateFacts = db
      .query<{ effect_facts_json: string }, [string]>(
        `SELECT effect_facts_json FROM item_presentation_rows WHERE id = ?`,
      )
      .get("7ab10c55.fixture-slate-spell");
    expect(JSON.parse(slateFacts!.effect_facts_json)).toEqual([
      expect.objectContaining({
        targetId: "named;spell;spell_fire-shield",
        level: 1,
        source: "spellDataJson",
      }),
      expect.objectContaining({
        targetId: "named;spell;spell_arcane-surge",
        level: 2,
        source: "secondarySpellDataJson",
      }),
    ]);
    const castsEdges = db
      .query(
        `SELECT edge_id, target_id, predicate, label, evidence_json
         FROM entity_edges
         WHERE source_id = '7ab10c55.fixture-slate-spell' AND predicate = 'casts'
         ORDER BY edge_id`,
      )
      .all() as {
      edge_id: string;
      target_id: string;
      predicate: string;
      label: string;
      evidence_json: string;
    }[];
    expect(castsEdges).toHaveLength(2);
    expect(castsEdges).toEqual([
      expect.objectContaining({
        edge_id: "7ab10c55.fixture-slate-spell:casts:spell:named;spell;spell_arcane-surge",
        target_id: "named;spell;spell_arcane-surge",
        predicate: "casts",
        label: "Casts",
      }),
      expect.objectContaining({
        edge_id: "7ab10c55.fixture-slate-spell:casts:spell:named;spell;spell_fire-shield",
        target_id: "named;spell;spell_fire-shield",
        predicate: "casts",
        label: "Casts",
      }),
    ]);
    expect(JSON.parse(castsEdges[0]!.evidence_json)).toEqual({
      source: "items.spellRef",
      level: 2,
    });
    expect(JSON.parse(castsEdges[1]!.evidence_json)).toEqual({
      source: "items.spellRef",
      level: 1,
    });
    const fireFacts = db
      .query<{ effect_facts_json: string }, [string]>(
        `SELECT effect_facts_json FROM item_presentation_rows WHERE id = ?`,
      )
      .get("8c0ffee0.fixture-throwing-potion");
    expect(JSON.parse(fireFacts!.effect_facts_json)[0]).toEqual(
      expect.objectContaining({ targetId: null }),
    );
    expect(JSON.parse(fireFacts!.effect_facts_json)[1]).toEqual(
      expect.objectContaining({ targetId: null, targetType: "spell" }),
    );
    expect(
      db
        .query(
          `SELECT count(*) AS count FROM entity_edges
           WHERE source_id = '8c0ffee0.fixture-throwing-potion' AND predicate = 'casts'`,
        )
        .get(),
    ).toEqual({ count: 0 });
    expect(
      db
        .query(
          `SELECT code, entity_id FROM pipeline_diagnostics
           WHERE entity_id = '8c0ffee0.fixture-throwing-potion'
             AND code IN ('itemStatusEffectUnresolved', 'itemSpellUnresolved')
           ORDER BY code`,
        )
        .all(),
    ).toEqual([
      { code: "itemSpellUnresolved", entity_id: "8c0ffee0.fixture-throwing-potion" },
      { code: "itemStatusEffectUnresolved", entity_id: "8c0ffee0.fixture-throwing-potion" },
    ]);
    expect(
      JSON.parse(
        db
          .query<{ effect_facts_json: string }, [string]>(
            `SELECT effect_facts_json FROM item_presentation_rows WHERE id = ?`,
          )
          .get("4ed20218.fixture-iron-sword")!.effect_facts_json,
      ),
    ).toEqual([]);

    const taggedEdges = db
      .query(
        `SELECT edge_id, target_id, predicate, label, evidence_json
         FROM entity_edges
         WHERE source_id = '6a71c0de.fixture-stamina-draught' AND predicate = 'tagged'
         ORDER BY edge_id`,
      )
      .all() as {
      edge_id: string;
      target_id: string;
      predicate: string;
      label: string;
      evidence_json: string;
    }[];
    expect(taggedEdges).toHaveLength(2);
    expect(taggedEdges.map((edge) => edge.edge_id)).toEqual([
      "6a71c0de.fixture-stamina-draught:tagged:item-tag:7a600001.fixture-tag-valuable-remedy",
      "6a71c0de.fixture-stamina-draught:tagged:item-tag:7a600002.fixture-tag-rare",
    ]);
    expect(taggedEdges.map((edge) => edge.target_id)).toEqual([
      "7a600001.fixture-tag-valuable-remedy",
      "7a600002.fixture-tag-rare",
    ]);
    expect(
      taggedEdges.every((edge) => edge.predicate === "tagged" && edge.label === "Tagged"),
    ).toBe(true);
    expect(JSON.parse(taggedEdges[0]!.evidence_json)).toEqual({ source: "items.tags" });
    expect(
      db
        .query(
          `SELECT COUNT(*) AS count FROM entity_edges
           WHERE source_id = '4ed20218.fixture-iron-sword' AND predicate = 'tagged'`,
        )
        .get(),
    ).toEqual({ count: 0 });
    expect(
      db
        .query(
          `SELECT COUNT(*) AS count FROM pipeline_diagnostics
           WHERE entity_id = '4ed20218.fixture-iron-sword' AND code = 'itemTagUnresolved'`,
        )
        .get(),
    ).toEqual({ count: 0 });
    const categoryEdges = db
      .query(
        `SELECT edge_id, target_id, predicate, label, evidence_json
         FROM entity_edges
         WHERE source_id = '4ed20218.fixture-iron-sword' AND predicate = 'categorised_as'`,
      )
      .all() as {
      edge_id: string;
      target_id: string;
      predicate: string;
      label: string;
      evidence_json: string;
    }[];
    expect(categoryEdges).toEqual([
      {
        edge_id:
          "4ed20218.fixture-iron-sword:categorised_as:item-category:named;item-category;itemcat_weapons",
        target_id: "named;item-category;itemcat_weapons",
        predicate: "categorised_as",
        label: "Category",
        evidence_json: JSON.stringify({ source: "items.categoryRef" }),
      },
    ]);
    expect(
      db
        .query(
          `SELECT COUNT(*) AS count FROM entity_edges
           WHERE source_id = '8c0ffee0.fixture-throwing-potion' AND predicate = 'categorised_as'`,
        )
        .get(),
    ).toEqual({ count: 0 });
    expect(
      db
        .query(
          `SELECT code, entity_id, field FROM pipeline_diagnostics
           WHERE entity_id = '8c0ffee0.fixture-throwing-potion' AND code = 'itemCategoryUnresolved'`,
        )
        .get(),
    ).toEqual({
      code: "itemCategoryUnresolved",
      entity_id: "8c0ffee0.fixture-throwing-potion",
      field: "items.categoryRef",
    });

    const variantSection = db
      .query(
        "SELECT title, edges_json FROM entity_relationship_sections WHERE source_type = 'item' AND source_id = '4ed20218.fixture-iron-sword' AND predicate = 'variant_of'",
      )
      .get() as { title: string; edges_json: string };
    expect(variantSection.title).toBe("Variant");
    expect(JSON.parse(variantSection.edges_json)).toContainEqual(
      expect.objectContaining({
        targetType: "item-variant",
        targetId: "melee-weapon",
        targetRoutePath: "/objects/variant/melee-weapon",
      }),
    );

    const termEdge = db
      .query(
        "SELECT target_type, target_id, predicate FROM entity_edges WHERE source_id = '6a71c0de.fixture-stamina-draught' AND predicate = 'references_term'",
      )
      .get() as { target_type: string; target_id: string; predicate: string };
    expect(termEdge).toEqual({
      target_type: "term",
      target_id: "stamina",
      predicate: "references_term",
    });

    const itemNode = db
      .query(
        "SELECT route_path, canonical_slug, short_id FROM entity_nodes WHERE entity_type = 'item' AND entity_id = '4ed20218.fixture-iron-sword'",
      )
      .get() as { route_path: string; canonical_slug: string; short_id: string };
    expect(itemNode.route_path).toBe("/objects/4ed20218.fixture-iron-sword");
    expect(itemNode.canonical_slug).toBe("iron-sword--4ed20218");
    expect(itemNode.short_id).toBe("4ed20218");

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
    ).toEqual({ count: 1 });

    const categories = db
      .query(
        "SELECT category_id, label, href, item_count FROM item_overview_categories ORDER BY category_id",
      )
      .all() as { category_id: string; label: string; href: string; item_count: number }[];
    expect(categories).toContainEqual({
      category_id: "melee-weapon",
      label: "Melee Weapon",
      href: "/objects/variant/melee-weapon",
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
  async function setupStatReadModel() {
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
    canonicaliseStatTypes(db, statEnvelope);
    return { db, snap };
  }

  it("emits stat overview, presentation, and entity nodes", async () => {
    const { db, snap } = await setupStatReadModel();
    db.run(
      "INSERT INTO asset_refs (entity_id, entity_row_id, slot, asset_kind, asset_hash) VALUES (?, ?, ?, ?, ?)",
      ["stat-type", "named;stat-type;att_strength", "iconRef", "image", "b".repeat(64)],
    );

    db.run("UPDATE stat_types SET affects_json = ? WHERE id = ?", [
      JSON.stringify(["ALCHEMY  ", " melee-damage "]),
      "named;stat-type;att_strength",
    ]);
    emitStatTypeReadModels(db, snap.masterTooltip, "/attributes");

    const overview = db
      .query<{ id: string; name: string; grouping: string; icon_hash: string | null }, []>(
        "SELECT id, name, grouping, icon_hash FROM stat_type_overview_rows ORDER BY name",
      )
      .all();
    expect(overview).toEqual([
      {
        id: "named;stat-type;sk_alchemy",
        name: "Alchemy",
        grouping: "skill",
        icon_hash: null,
      },
      {
        id: "named;stat-type;att_strength",
        name: "Strength",
        grouping: "attribute",
        icon_hash: "b".repeat(64),
      },
    ]);

    const presentation = db
      .query<{ render_context: string; icon_hash: string | null; affects_json: string }, []>(
        "SELECT render_context, icon_hash, affects_json FROM stat_type_presentation_rows WHERE id = 'named;stat-type;att_strength'",
      )
      .get();
    expect(presentation?.render_context).toBe("stat-type-presentation-v1");
    expect(presentation?.icon_hash).toBe("b".repeat(64));
    const affects = JSON.parse(presentation?.affects_json ?? "[]") as {
      label: string;
      routePath: string | null;
    }[];
    expect(affects).toContainEqual({
      label: "ALCHEMY",
      routePath: "/attributes/alchemy--sk-alchemy",
    });
    expect(affects).toContainEqual({ label: "melee-damage", routePath: null });

    const node = db
      .query<{ route_path: string; canonical_slug: string; short_id: string }, []>(
        "SELECT route_path, canonical_slug, short_id FROM entity_nodes WHERE entity_type = 'stat-type' AND entity_id = 'named;stat-type;att_strength'",
      )
      .get();
    expect(node?.short_id).toBe("att-strength");
    expect(node?.canonical_slug).toBe("strength--att-strength");
    expect(node?.route_path).toBe(`/attributes/${node?.canonical_slug}`);
  });

  it("does not diagnose stats present in their published vocabulary", async () => {
    const { db, snap } = await setupStatReadModel();
    const diagnostics = emitStatTypeReadModels(db, {
      ...snap.masterTooltip,
      allAttributes: ["strength"],
      allSkills: ["alchemy"],
    });
    expect(diagnostics).toEqual([]);
  });

  it("diagnoses an authored stat absent from its vocabulary while retaining the row", async () => {
    const { db, snap } = await setupStatReadModel();
    const diagnostics = emitStatTypeReadModels(db, {
      ...snap.masterTooltip,
      allAttributes: ["strength"],
      allSkills: [],
    });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toEqual(
      expect.objectContaining({
        severity: "diagnostic",
        message: expect.stringContaining("Alchemy"),
      }),
    );
    expect(
      db.query("SELECT name FROM stat_type_overview_rows WHERE name = 'Alchemy'").all(),
    ).toHaveLength(1);
  });

  it("checks attributes and skills against their respective lists", async () => {
    const { db, snap } = await setupStatReadModel();
    const diagnostics = emitStatTypeReadModels(db, {
      ...snap.masterTooltip,
      allAttributes: ["strength", "alchemy"],
      allSkills: [],
    });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toEqual(
      expect.objectContaining({
        severity: "diagnostic",
        entityId: "named;stat-type;sk_alchemy",
        message: expect.stringContaining("allSkills"),
      }),
    );
  });

  it("does not diagnose when the master tooltip is absent", async () => {
    const { db } = await setupStatReadModel();
    expect(emitStatTypeReadModels(db)).toEqual([]);
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
          id: "named;item-category;itemcat_weapons",
          fields: {
            id: "named;item-category;itemcat_weapons",
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
    db.run(`INSERT INTO items (id, name, "categoryRef", "categoryName") VALUES (?, ?, ?, ?)`, [
      "4ed20218.fixture-iron-sword",
      "Iron Sword",
      JSON.stringify({ kind: "namedAsset", entity: "item-category", name: "itemcat_weapons" }),
      "Weapons",
    ]);
    db.run(`INSERT INTO items (id, name, "categoryRef", "categoryName") VALUES (?, ?, ?, ?)`, [
      "fixture-training-dagger",
      "Training Dagger",
      JSON.stringify({ kind: "missing", reason: "lookupAssetGuidMissing" }),
      "Weapons",
    ]);
    db.run(
      "INSERT INTO asset_refs (entity_id, entity_row_id, slot, asset_kind, asset_hash) VALUES (?, ?, ?, ?, ?)",
      [
        "item-category",
        "named;item-category;itemcat_weapons",
        "defaultItemIconRef",
        "image",
        "c".repeat(64),
      ],
    );

    emitItemCategoryReadModels(db, "/groups");

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
      id: "named;item-category;itemcat_weapons",
      name: "Weapons",
      default_item_icon_hash: "c".repeat(64),
      category_color_json: JSON.stringify({ r: 0.92, g: 0.42, b: 0.42, a: 1 }),
      item_count: 1,
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
        "SELECT render_context, columns_json, show_in_all_category, item_count FROM item_category_presentation_rows WHERE id = 'named;item-category;itemcat_weapons'",
      )
      .get();
    expect(presentation?.render_context).toBe("item-category-presentation-v1");
    expect(JSON.parse(presentation?.columns_json ?? "[]")).toEqual([
      { label: "Name", flexibleWidth: 2 },
    ]);
    expect(presentation?.show_in_all_category).toBe(1);
    expect(presentation?.item_count).toBe(1);

    const node = db
      .query<{ route_path: string; canonical_slug: string; short_id: string }, []>(
        "SELECT route_path, canonical_slug, short_id FROM entity_nodes WHERE entity_type = 'item-category' AND entity_id = 'named;item-category;itemcat_weapons'",
      )
      .get();
    expect(node?.short_id).toBe("itemcat-weapons");
    expect(node?.canonical_slug).toBe("weapons--itemcat-weapons");
    expect(node?.route_path).toBe(`/groups/${node?.canonical_slug}`);
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
          id: "7a600001.tag-valuable-remedy",
          fields: {
            id: "7a600001.tag-valuable-remedy",
            tagName: "Valuable remedy",
            description: "Incredibly valuable remedy",
          },
        },
        {
          id: "7a600002.tag-rare",
          fields: {
            id: "7a600002.tag-rare",
            tagName: "Rare",
            description: "",
          },
        },
      ],
    });
    db.run(
      "INSERT INTO item_overview_rows (id, name, display_icon_hash, display_icon_color) VALUES (?, ?, ?, ?)",
      ["6a71c0de.fixture-stamina-draught", "Stamina Draught", null, null],
    );
    db.run("INSERT INTO item_tag_refs (item_id, tag) VALUES (?, ?)", [
      "6a71c0de.fixture-stamina-draught",
      "7a600001.tag-valuable-remedy",
    ]);

    emitItemTagReadModels(db, "/labels");

    const overview = db
      .query<{ id: string; name: string; description: string; item_count: number }, []>(
        "SELECT id, name, description, item_count FROM item_tag_overview_rows ORDER BY name",
      )
      .all();
    expect(overview).toEqual([
      { id: "7a600002.tag-rare", name: "Rare", description: "", item_count: 0 },
      {
        id: "7a600001.tag-valuable-remedy",
        name: "Valuable remedy",
        description: "Incredibly valuable remedy",
        item_count: 1,
      },
    ]);

    const presentation = db
      .query<{ render_context: string; description: string; item_count: number }, []>(
        "SELECT render_context, description, item_count FROM item_tag_presentation_rows WHERE id = '7a600001.tag-valuable-remedy'",
      )
      .get();
    expect(presentation).toEqual({
      render_context: "item-tag-presentation-v1",
      description: "Incredibly valuable remedy",
      item_count: 1,
    });

    const node = db
      .query<{ route_path: string; canonical_slug: string; short_id: string }, []>(
        "SELECT route_path, canonical_slug, short_id FROM entity_nodes WHERE entity_type = 'item-tag' AND entity_id = '7a600001.tag-valuable-remedy'",
      )
      .get();
    expect(node?.canonical_slug).toBe("valuable-remedy--7a600001");
    expect(node?.route_path).toBe("/labels/valuable-remedy--7a600001");
    expect(node?.short_id).toBe("7a600001");
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
          "SELECT entity_type, entity_id, canonical_slug, short_id, has_page FROM entity_nodes ORDER BY entity_type",
        )
        .all(),
    ).toEqual([
      {
        entity_type: "item-tag",
        entity_id: "valuable-remedy",
        canonical_slug: "valuable-remedy",
        short_id: "valuable-remedy",
        has_page: 1,
      },
      {
        entity_type: "stat-type",
        entity_id: "4ed202185a05d98439595e3fcab021c8.11400000",
        canonical_slug: "heavy-armor-skill--4ed20218",
        short_id: "4ed20218",
        has_page: 1,
      },
    ]);
  });
});

describe("emitMapReadModels", () => {
  it("builds map point and volume read models from canonical locations", () => {
    const db = new Database(":memory:");
    db.exec(LOCATION_DDL);
    canonicaliseLocations(db, {
      entityId: "location",
      schemaVersion: 1,
      rows: [
        {
          id: "11111111.fixture-town",
          fields: {
            id: "11111111.fixture-town",
            name: "Harbor Town",
            enabled: true,
            mapId: "ardenfall",
            showOnMap: true,
            showOnMapDebugOnly: false,
            mapPosition: { x: 12, y: 3, z: -8 },
            allowFastTravel: true,
            fastTravelPosition: { x: 14, y: 4, z: -10 },
            volumes: [{ index: 0, center: { x: 10, y: 2, z: -20 }, size: { x: 6, y: 4, z: 8 } }],
          },
        },
      ],
    });

    emitMapReadModels(db, ["location"]);

    expect(db.query("SELECT * FROM map_points").get()).toEqual({
      id: "location:11111111.fixture-town",
      entity_id: "location",
      instance_id: "11111111.fixture-town",
      name: "Harbor Town",
      map_id: "ardenfall",
      map_x: 12,
      map_y: 8,
      elevation: 3,
      show_on_map_debug_only: 0,
      allow_fast_travel: 1,
    });

    const volume = db
      .query("SELECT entity_id, instance_id, name, geometry_json FROM map_volumes")
      .get() as {
      entity_id: string;
      instance_id: string;
      name: string;
      geometry_json: string;
    };
    expect(volume.entity_id).toBe("location");
    expect(volume.instance_id).toBe("11111111.fixture-town");
    expect(volume.name).toBe("Harbor Town");
    expect(JSON.parse(volume.geometry_json).ring).toEqual([
      [7, 16],
      [13, 16],
      [13, 24],
      [7, 24],
      [7, 16],
    ]);
  });

  it("includes debug-only map points so the map can offer a debug toggle", () => {
    const db = new Database(":memory:");
    db.exec(LOCATION_DDL);
    canonicaliseLocations(db, {
      entityId: "location",
      schemaVersion: 1,
      rows: [
        {
          id: "22222222.fixture-debug-cave",
          fields: {
            id: "22222222.fixture-debug-cave",
            name: "Debug Cave",
            enabled: true,
            mapId: null,
            showOnMap: true,
            showOnMapDebugOnly: true,
            mapPosition: { x: -5, y: 1, z: 9 },
            allowFastTravel: false,
            fastTravelPosition: null,
            volumes: [],
          },
        },
      ],
    });

    emitMapReadModels(db, ["location"]);

    expect(
      db
        .query("SELECT instance_id, show_on_map_debug_only FROM map_points WHERE instance_id = ?")
        .get("22222222.fixture-debug-cave"),
    ).toEqual({ instance_id: "22222222.fixture-debug-cave", show_on_map_debug_only: 1 });
  });

  it("includes record-backed portal map points", () => {
    const db = new Database(":memory:");
    db.exec(LOCATION_DDL);
    db.exec(PORTAL_DDL);
    canonicaliseLocations(db, {
      entityId: "location",
      schemaVersion: 1,
      rows: [
        {
          id: "11111111.fixture-town",
          fields: {
            id: "11111111.fixture-town",
            name: "Harbor Town",
            enabled: true,
            mapId: "ardenfall",
            showOnMap: true,
            showOnMapDebugOnly: false,
            mapPosition: { x: 12, y: 3, z: -8 },
            allowFastTravel: true,
            fastTravelPosition: null,
            volumes: [],
          },
        },
      ],
    });
    canonicalisePortals(db, {
      entityId: "portal",
      schemaVersion: 1,
      rows: [
        {
          id: "instances;portals;398213e43a41b4c47bffe4ef1998e782",
          fields: {
            id: "instances;portals;398213e43a41b4c47bffe4ef1998e782",
            recordRef: {
              kind: "record",
              table: "instances",
              subtable: "portals",
              id: "398213e43a41b4c47bffe4ef1998e782",
            },
            friendlyName: "Harbor Gate",
            mapId: "ardenfall",
            position: { x: 20, y: 5, z: -30 },
            connectedPortalRef: {
              kind: "record",
              table: "instances",
              subtable: "portals",
              id: "8f17d2c4a6b8490e9d31c7f2e5a4b608",
            },
          },
        },
      ],
    });

    emitMapReadModels(db, ["location", "portal"]);
    emitPortalReadModels(db);

    expect(
      db
        .query(
          `SELECT id, entity_id, instance_id, name, map_id, map_x, map_y, elevation
           FROM map_points WHERE entity_id = 'portal'`,
        )
        .get(),
    ).toEqual({
      id: "portal:instances;portals;398213e43a41b4c47bffe4ef1998e782",
      entity_id: "portal",
      instance_id: "instances;portals;398213e43a41b4c47bffe4ef1998e782",
      name: "Harbor Gate",
      map_id: "ardenfall",
      map_x: 20,
      map_y: 30,
      elevation: 5,
    });
    const node = db
      .query(
        `SELECT route_path, short_id, has_page FROM entity_nodes
         WHERE entity_type = 'portal' AND entity_id = 'instances;portals;398213e43a41b4c47bffe4ef1998e782'`,
      )
      .get() as { route_path: string; short_id: string; has_page: number };
    expect(node.short_id).toBe("398213e4");
    expect(node.route_path).toBe("/portals/harbor-gate--398213e4");
    expect(node.has_page).toBe(1);
  });

  it("fails fast when a requested entity has no map projection", () => {
    const db = new Database(":memory:");
    db.exec(LOCATION_DDL);

    expect(() => emitMapReadModels(db, ["location", "creature"])).toThrow(
      "no map projection for entity 'creature'",
    );
  });
});
