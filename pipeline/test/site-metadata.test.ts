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
        "SELECT field_id FROM site_overview_columns WHERE entity_id = 'item' ORDER BY position",
      )
      .all() as { field_id: string }[];
    expect(cols.map((c) => c.field_id)).toEqual(["name", "value", "weight", "variant"]);

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
    ]);
  });
});
