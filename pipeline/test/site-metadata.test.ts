import { describe, it, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { emitSiteMetadata } from "$pipeline/stages/emit-site-metadata";
import { SITE_METADATA_DDL } from "$pipeline/sql/site-metadata-ddl";
import type { EntityDescriptor, FieldType } from "$pipeline/types";
import { loadDescriptors } from "$pipeline/stages/load-descriptors";
import type { LoadDescriptorsOutput } from "$pipeline/stages/load-descriptors";

const ctx = { workspaceRoot: ".", snapshotDir: "", outDir: ".", log: () => undefined };

const fieldTypeKinds: Array<[string, FieldType, string]> = [
  ["id", "id", "id"],
  ["string", "string", "string"],
  ["integer", "integer", "integer"],
  ["number", "number", "number"],
  ["boolean", "boolean", "boolean"],
  ["json", "json", "json"],
  ["assetRef", "ref:asset", "ref"],
  ["assetRefs", "ref:asset[]", "json"],
  ["recordRef", "ref:record", "ref"],
];

describe("emitSiteMetadata", () => {
  it("maps every descriptor field type to its site value kind", () => {
    const entity: EntityDescriptor = {
      id: "type-test",
      kind: "instance",
      label: { singular: "Type test", plural: "Type tests" },
      extraction: { source: "record", root: "TypeTest.Root" },
      canonicalTable: "type_tests",
      fields: fieldTypeKinds.map(([name, type]) => ({ name, type, from: name })),
      site: { route: "/type-test" },
      map: null,
    };
    const db = new Database(":memory:");
    db.exec(SITE_METADATA_DDL);
    emitSiteMetadata(db, { entities: { [entity.id]: entity }, variants: {} });

    const rows = db
      .query(
        "SELECT field_id, value_kind FROM site_entity_fields WHERE entity_id = 'type-test' ORDER BY field_id",
      )
      .all() as { field_id: string; value_kind: string }[];
    expect(rows).toEqual(
      [...fieldTypeKinds]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([fieldId, , valueKind]) => ({ field_id: fieldId, value_kind: valueKind })),
    );
  });

  it("throws when an unknown field type reaches the dispatcher", () => {
    const entity = {
      id: "type-test",
      kind: "instance",
      label: { singular: "Type test", plural: "Type tests" },
      extraction: { source: "record", root: "TypeTest.Root" },
      canonicalTable: "type_tests",
      fields: [{ name: "mystery", type: "mystery", from: "value" }],
      site: { route: "/type-test" },
      map: null,
    } as unknown as EntityDescriptor;
    const db = new Database(":memory:");
    db.exec(SITE_METADATA_DDL);

    expect(() =>
      emitSiteMetadata(db, {
        entities: { [entity.id]: entity },
        variants: {},
      } as LoadDescriptorsOutput),
    ).toThrow("unsupported type 'mystery' for field 'mystery'");
  });
  it("populates site_entities, fields, columns, item_variants", async () => {
    const desc = await loadDescriptors.run({}, ctx);
    const db = new Database(":memory:");
    db.exec(SITE_METADATA_DDL);
    emitSiteMetadata(db, desc);

    const ent = db.query("SELECT * FROM site_entities WHERE entity_id = 'item'").get() as {
      route_path: string;
    };
    const item = desc.entities.item;
    if (!item?.site?.route) throw new Error("descriptor missing item site route");
    expect(ent.route_path).toBe(item.site.route);
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
      { read_model_id: "character_overview_rows", entity_id: "character" },
      { read_model_id: "character_presentation_rows", entity_id: "character" },
      { read_model_id: "faction_overview_rows", entity_id: "faction" },
      { read_model_id: "faction_presentation_rows", entity_id: "faction" },
      { read_model_id: "item_overview_rows", entity_id: "item" },
      { read_model_id: "item_presentation_rows", entity_id: "item" },
    ]);
  });

  it("skips descriptors without public site metadata", () => {
    const db = new Database(":memory:");
    db.exec(SITE_METADATA_DDL);

    emitSiteMetadata(db, {
      entities: {
        internal: {
          id: "internal",
          kind: "instance",
          label: { singular: "Internal", plural: "Internals" },
          extraction: { source: "record", root: "Internal.Root" },
          canonicalTable: "internals",
          fields: [{ name: "id", type: "id", from: "id", missingPolicy: "fatal" }],
          map: null,
        },
      },
      variants: { internal: [] },
    });

    expect(db.query("SELECT * FROM site_entities WHERE entity_id = 'internal'").get()).toBeNull();
  });

  it("emits a descriptor-owned map layer and a site entity for locations", async () => {
    const desc = await loadDescriptors.run({}, ctx);
    const db = new Database(":memory:");
    db.exec(SITE_METADATA_DDL);

    emitSiteMetadata(db, desc);

    const layer = db
      .query(
        `SELECT layer_id, entity_id, source_table, source_tables_json, render_kind, icon,
                color_json, radius, tooltip_fields_json, filters_json, legend_label, z_order
         FROM map_layers WHERE layer_id = 'locations'`,
      )
      .get() as {
      layer_id: string;
      entity_id: string;
      source_table: string;
      source_tables_json: string;
      render_kind: string;
      icon: string | null;
      color_json: string;
      radius: number | null;
      tooltip_fields_json: string;
      filters_json: string;
      legend_label: string;
      z_order: number;
    };

    expect(layer).toEqual({
      layer_id: "locations",
      entity_id: "location",
      source_table: "map_points",
      source_tables_json: JSON.stringify(["map_points", "map_volumes"]),
      render_kind: "point-or-polygon",
      icon: "location",
      color_json: JSON.stringify([120, 170, 255]),
      radius: 6,
      tooltip_fields_json: JSON.stringify(["name"]),
      filters_json: JSON.stringify([]),
      legend_label: "Locations",
      z_order: 100,
    });

    // A location has both a map layer and a page, so it must reach `site_entities`. The site
    // resolves a route and a label from that row, and it fails loudly without one.
    expect(
      db.query("SELECT * FROM site_entities WHERE entity_id = 'location'").get(),
    ).toMatchObject({ entity_id: "location", route_path: "/locations" });
  });
});
