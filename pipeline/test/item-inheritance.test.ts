import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { canonicaliseCharacters } from "../src/entities/character/canonicaliser.ts";
import { emitCharacterReadModels } from "../src/entities/character/read-models.ts";
import {
  collectTransitiveDescendants,
  deriveEntityNodeSlug,
  emitItemReadModels,
} from "../src/entities/item/read-models.ts";
import { canonicaliseEnchantments } from "../src/entities/enchantment/canonicaliser.ts";
import { emitEnchantmentReadModels } from "../src/entities/enchantment/read-models.ts";
import { ENTITY_GRAPH_DDL } from "../src/relationships/relationship-graph.ts";
import { CHARACTER_DDL } from "../src/sql/character-ddl.ts";
import { ENCHANTMENT_DDL } from "../src/sql/enchantment-ddl.ts";

describe("item inheritance", () => {
  it("resolves a prototype to all publishable transitive descendants", () => {
    const prototype = "prototype";
    const child = "child";
    const grandchild = "grandchild";
    const sibling = "sibling";
    const result = collectTransitiveDescendants(
      new Map([
        [child, prototype],
        [grandchild, child],
        [sibling, prototype],
      ]),
      new Set([child, grandchild, sibling]),
    );

    expect(result.descendantsByAncestor.get(prototype)).toEqual([child, grandchild, sibling]);
    expect(result.cycles).toEqual([]);
  });

  it("guards a cyclic parent chain", () => {
    const result = collectTransitiveDescendants(
      new Map([
        ["a", "b"],
        ["b", "a"],
      ]),
      new Set(["a", "b"]),
    );

    expect(result.descendantsByAncestor.get("a")).toEqual(["b"]);
    expect(result.cycles).toEqual([
      ["a", "b", "b"],
      ["a", "a", "b"],
    ]);
  });

  it("publishes and marks a templated item", () => {
    const db = new Database(":memory:");
    db.exec(`
      CREATE TABLE items (
        id TEXT PRIMARY KEY,
        name TEXT,
        variant TEXT,
        "categoryRef" TEXT,
        parent_ref_json TEXT,
        weight REAL,
        value INTEGER
      );
      CREATE TABLE asset_refs (
        entity_id TEXT NOT NULL,
        entity_row_id TEXT NOT NULL,
        slot TEXT NOT NULL,
        asset_kind TEXT NOT NULL,
        asset_hash TEXT NOT NULL,
        PRIMARY KEY (entity_id, entity_row_id, slot)
      );
      CREATE TABLE item_categories (id TEXT PRIMARY KEY);
      CREATE TABLE item_tags (id TEXT PRIMARY KEY);
      CREATE TABLE item_tag_refs (item_id TEXT NOT NULL, tag TEXT NOT NULL);
    `);
    db.run(
      `INSERT INTO items (id, name, variant, parent_ref_json, weight, value)
       VALUES (?, ?, ?, NULL, ?, ?)`,
      ["a7000001.11400000", "BASE ring", "ring", 1, 10],
    );

    emitItemReadModels(
      db,
      {
        entities: { item: { site: { route: "/items" } } },
        variants: { item: [{ variantId: "ring", label: "Ring" }] },
      } as never,
      [],
      {
        entityId: "item",
        schemaVersion: 1,
        rows: [
          {
            id: "a7000001.11400000",
            fields: {},
            variant: "ring",
            presentation: {
              schemaVersion: 1,
              renderContext: "item-presentation-v1",
              displayName: "BASE ring",
              displayNameSourceMethod: "test",
              itemType: "ring",
              itemTypeSourceMethod: "test",
              descriptionSource: "",
              effectsSource: "",
              effects: [],
              statRows: [],
              requirements: [],
              durability: null,
              stateFacts: [],
              value: 10,
              weight: 1,
              diagnostics: [],
            },
          },
        ],
      },
    );

    expect(db.query(`SELECT id, name FROM item_overview_rows`).all()).toEqual([
      { id: "a7000001.11400000", name: "Unnamed item — Ring" },
    ]);
    expect(
      db
        .query(
          `SELECT route_path, has_page FROM entity_nodes
           WHERE entity_type = 'item' AND entity_id = 'a7000001.11400000'`,
        )
        .get(),
    ).toEqual({ route_path: "/items/unnamed-item-ring--a7000001", has_page: 1 });
    expect(
      db
        .query(
          `SELECT name_is_placeholder FROM item_presentation_rows
           WHERE id = 'a7000001.11400000'`,
        )
        .get(),
    ).toEqual({ name_is_placeholder: 1 });
    expect(
      db
        .query(
          `SELECT code FROM pipeline_diagnostics
           WHERE entity_id = 'a7000001.11400000'`,
        )
        .all(),
    ).toEqual([{ code: "itemNamePlaceholder" }]);
    db.close();
  });
});

describe("enchantment inheritance", () => {
  it("fans out a prototype whitelist and omits the prototype edge", () => {
    const db = new Database(":memory:");
    db.exec(`${ENCHANTMENT_DDL}${ENTITY_GRAPH_DDL}`);
    db.exec(`CREATE TABLE items (id TEXT PRIMARY KEY, parent_ref_json TEXT)`);
    seedItem(db, "a7000001.11400000", "BASE weapon", null, 0);
    seedItem(db, "a7000002.11400000", "Child", JSON.stringify(ref("a7000001.11400000")), 1);
    seedItem(db, "a7000003.11400000", "Grandchild", JSON.stringify(ref("a7000002.11400000")), 1);
    seedItem(db, "a7000004.11400000", "Sibling", JSON.stringify(ref("a7000001.11400000")), 1);
    canonicaliseEnchantments(db, {
      entityId: "a8000001.11400000",
      schemaVersion: 1,
      rows: [
        {
          id: "a8000001.11400000",
          fields: {
            id: "a8000001.11400000",
            enchantmentName: "Test",
            moneyValue: 1,
            hideEffectTooltips: false,
            appliesToItemRefs: [ref("a7000001.11400000")],
            effects: [],
          },
        },
      ],
    });
    const diagnostics = emitEnchantmentReadModels(db);

    expect(diagnostics).toEqual([]);
    expect(
      db
        .query<{ target_id: string }, []>(
          `SELECT target_id FROM entity_edges WHERE predicate = 'enchants' ORDER BY target_id`,
        )
        .all(),
    ).toEqual([
      { target_id: "a7000002.11400000" },
      { target_id: "a7000003.11400000" },
      { target_id: "a7000004.11400000" },
    ]);
    expect(
      db.query(`SELECT target_id FROM entity_edges WHERE target_id = 'a7000001.11400000'`).all(),
    ).toEqual([]);
    db.close();
  });
});

describe("prototype loot diagnostics", () => {
  it("publishes a prototype loot edge and emits its diagnostic", () => {
    const db = new Database(":memory:");
    db.exec(`${CHARACTER_DDL}${ENTITY_GRAPH_DDL}`);
    db.exec(`CREATE TABLE items (id TEXT PRIMARY KEY, parent_ref_json TEXT)`);
    db.exec(
      `CREATE TABLE item_presentation_rows (id TEXT PRIMARY KEY, name_is_placeholder INTEGER NOT NULL)`,
    );
    seedItem(db, "a7000001.11400000", "Unnamed item — Melee weapon", null, 1);
    db.run(`INSERT INTO item_presentation_rows (id, name_is_placeholder) VALUES (?, 1)`, [
      "a7000001.11400000",
    ]);
    canonicaliseCharacters(db, {
      entityId: "named;character;fixture-character",
      schemaVersion: 1,
      rows: [
        {
          id: "named;character;fixture-character",
          fields: {
            id: "named;character;fixture-character",
            name: "Character",
            parentRef: missingRef(),
            raceRef: null,
            dropRefs: [ref("a7000001.11400000")],
          },
        },
      ],
    });
    const diagnostics = emitCharacterReadModels(db, "/character-types");

    expect(
      db
        .query(
          `SELECT label, route_path, has_page FROM entity_nodes
           WHERE entity_type = 'item' AND entity_id = 'a7000001.11400000'`,
        )
        .get(),
    ).toEqual({
      label: "Unnamed item — Melee weapon",
      route_path: "/items/unnamed-item-melee-weapon--a7000001",
      has_page: 1,
    });
    expect(
      db
        .query(
          `SELECT name_is_placeholder FROM item_presentation_rows
           WHERE id = 'a7000001.11400000'`,
        )
        .get(),
    ).toEqual({ name_is_placeholder: 1 });
    expect(diagnostics).toEqual([expect.objectContaining({ code: "itemLootReferencesPrototype" })]);
    expect(
      db.query(`SELECT target_id FROM entity_edges WHERE predicate = 'can_drop'`).all(),
    ).toEqual([{ target_id: "a7000001.11400000" }]);
    db.close();
  });
});

function ref(guid: string) {
  return { kind: "lookupAsset" as const, guid };
}

function missingRef() {
  return { kind: "missing" as const, reason: "noParent", source: "test" };
}

function seedItem(
  db: Database,
  id: string,
  label: string,
  parentRefJson: string | null,
  hasPage: number,
) {
  db.run(`INSERT INTO items (id, parent_ref_json) VALUES (?, ?)`, [id, parentRefJson]);
  const slug = deriveEntityNodeSlug(label, id);
  db.run(
    `INSERT INTO entity_nodes
      (entity_type, entity_id, label, display_label, route_path, canonical_slug, short_id, has_page)
     VALUES ('item', ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      label,
      label,
      hasPage === 1 ? `/items/${slug.canonicalSlug}` : null,
      slug.canonicalSlug,
      slug.shortId,
      hasPage,
    ],
  );
}
