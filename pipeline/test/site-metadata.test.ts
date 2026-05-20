import { describe, it, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { emitSiteMetadata } from "$pipeline/stages/emit-site-metadata";
import { SITE_METADATA_DDL } from "$pipeline/sql/site-metadata-ddl";
import { loadDescriptors } from "$pipeline/stages/load-descriptors";

const ctx = { workspaceRoot: ".", snapshotDir: "", outDir: ".", log: () => undefined };

describe("emitSiteMetadata", () => {
  it("populates site_entities, fields, columns, sections, item_variants", async () => {
    const desc = await loadDescriptors.run({}, ctx);
    const db = new Database(":memory:");
    db.exec(SITE_METADATA_DDL);
    emitSiteMetadata(db, desc);

    const ent = db.query("SELECT * FROM site_entities WHERE entity_id = 'item'").get() as {
      route_path: string;
    };
    expect(ent.route_path).toBe("/items");

    const cols = db
      .query(
        "SELECT field_id, renderer, sortable FROM site_overview_columns WHERE entity_id = 'item' ORDER BY position",
      )
      .all() as { field_id: string; renderer: string; sortable: number }[];
    expect(cols).toEqual([
      { field_id: "name", renderer: "itemNameWithIcon", sortable: 1 },
      { field_id: "value", renderer: "text", sortable: 1 },
      { field_id: "weight", renderer: "text", sortable: 1 },
      { field_id: "variant", renderer: "text", sortable: 1 },
    ]);

    const sections = db
      .query(
        "SELECT section_id, kind FROM site_detail_sections WHERE entity_id = 'item' ORDER BY position",
      )
      .all() as { section_id: string; kind: string }[];
    expect(sections.map((s) => s.section_id)).toEqual(["summary", "description"]);
    expect(sections.every((s) => s.kind === "fieldList")).toBe(true);

    const variants = db
      .query("SELECT variant_id, parent_variant_id FROM item_variants ORDER BY position")
      .all() as { variant_id: string; parent_variant_id: string | null }[];
    expect(variants.map((v) => v.variant_id)).toEqual([
      "basic",
      "currency",
      "equipment",
      "hand-item",
      "lockpick",
      "consumable",
      "primary-hand",
      "melee-weapon",
      "note",
      "armor",
      "potion-recipe",
      "repair-kit",
      "arrow",
      "bow",
      "slate-spell",
      "throwing-item",
      "throwing-potion",
    ]);

    const leafDamageFields = db
      .query(
        "SELECT field_id, source_table, source_column FROM site_entity_fields WHERE field_id IN ('bow.damage', 'throwing-item.damage') ORDER BY field_id",
      )
      .all() as { field_id: string; source_table: string; source_column: string }[];
    expect(leafDamageFields).toEqual([
      { field_id: "bow.damage", source_table: "item_bows", source_column: "damage" },
      {
        field_id: "throwing-item.damage",
        source_table: "item_throwing_items",
        source_column: "damage",
      },
    ]);
    const statVariantField = db
      .query(
        "SELECT field_id FROM site_entity_fields WHERE entity_id = 'stat-type' AND field_id = 'variant'",
      )
      .get();
    expect(statVariantField).toBeNull();

    const readModels = db
      .query("SELECT read_model_id, entity_id FROM site_read_models ORDER BY read_model_id")
      .all();
    expect(readModels).toEqual([
      { read_model_id: "item_overview_rows", entity_id: "item" },
      { read_model_id: "item_presentation_rows", entity_id: "item" },
    ]);
  });
});
