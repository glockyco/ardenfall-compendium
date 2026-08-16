import { describe, it, expect } from "bun:test";
import { buildDDL } from "$pipeline/sql/ddl";
import { loadDescriptors } from "$pipeline/stages/load-descriptors";
import type { EntityDescriptor, FieldType, VariantDescriptor } from "$pipeline/types";

const item: EntityDescriptor = {
  id: "item",
  kind: "definition",
  label: { singular: "Item", plural: "Items" },
  canonicalTable: "items",
  extraction: { source: "lookupAsset", root: "x", file: "items.json" },
  fields: [
    { name: "id", type: "id", from: "guid", missingPolicy: "fatal" },
    { name: "name", type: "string", from: "n", missingPolicy: "diagnostic" },
    { name: "weight", type: "number", from: "w", missingPolicy: "diagnostic" },
  ],
  variants: { dir: "variants" },
};

const equipment: VariantDescriptor = {
  variantId: "equipment",
  label: "Equipment",
  unityType: "Ardenfall.Item.EquipItemData",
  canonicalTable: "item_equipment",
  fields: [{ name: "equipSlot", type: "string", from: "s", missingPolicy: "diagnostic" }],
};

const allFieldTypes: Array<[string, FieldType, string]> = [
  ["id", "id", "TEXT"],
  ["string", "string", "TEXT"],
  ["integer", "integer", "INTEGER"],
  ["number", "number", "REAL"],
  ["boolean", "boolean", "INTEGER"],
  ["json", "json", "TEXT"],
  ["assetRef", "ref:asset", "TEXT"],
  ["assetRefs", "ref:asset[]", "TEXT"],
  ["recordRef", "ref:record", "TEXT"],
];

describe("buildDDL", () => {
  it("emits items table with id PRIMARY KEY", () => {
    const ddl = buildDDL(item, []);
    expect(ddl).toContain('CREATE TABLE "items"');
    expect(ddl).toContain('"id" TEXT NOT NULL PRIMARY KEY');
    expect(ddl).toContain('"name" TEXT');
    expect(ddl).toContain('"weight" REAL');
  });

  it("emits child tables with FK to parent", () => {
    const ddl = buildDDL(item, [equipment]);
    expect(ddl).toContain('CREATE TABLE "item_equipment"');
    expect(ddl).toContain('"id" TEXT NOT NULL PRIMARY KEY REFERENCES "items"("id")');
  });
  it("omits unstored fields from entity and variant tables", () => {
    const unstoredEntity: EntityDescriptor = {
      ...item,
      fields: [
        ...item.fields,
        {
          name: "mapPosition",
          type: "json",
          from: "mapPosition",
          storage: "unstored",
          reason: "Projects to map_points.",
          projects: "map_points",
        },
      ],
    };
    const unstoredVariant: VariantDescriptor = {
      ...equipment,
      fields: [
        ...equipment.fields,
        {
          name: "volumes",
          type: "json",
          from: "volumes",
          storage: "unstored",
          reason: "Projects to location_volumes.",
          projects: "location_volumes",
        },
      ],
    };

    const ddl = buildDDL(unstoredEntity, [unstoredVariant]);
    expect(ddl).not.toContain('"mapPosition"');
    expect(ddl).not.toContain('"volumes"');
    expect(ddl).toContain('"name" TEXT');
    expect(ddl).toContain('"equipSlot" TEXT');
  });

  it("maps every descriptor field type to its SQL type", () => {
    const entity: EntityDescriptor = {
      ...item,
      fields: [{ name: "id", type: "id", from: "guid", missingPolicy: "fatal" }],
    };
    const variant: VariantDescriptor = {
      ...equipment,
      fields: allFieldTypes.map(([name, type]) => ({
        name,
        type,
        from: name,
        missingPolicy: "diagnostic" as const,
      })),
    };
    const ddl = buildDDL(entity, [variant]);

    for (const [name, , sqlType] of allFieldTypes) {
      expect(ddl).toContain(`"${name}" ${sqlType}`);
    }
  });

  it("throws when an unknown field type reaches the dispatcher", () => {
    const entity = {
      ...item,
      fields: [{ name: "mystery", type: "mystery", from: "value" }],
    } as unknown as EntityDescriptor;

    expect(() => buildDDL(entity, [])).toThrow("unsupported type 'mystery' for field 'mystery'");
  });

  it("stores item equipment minimumSkill as INTEGER", async () => {
    const desc = await loadDescriptors.run(
      {},
      { workspaceRoot: ".", snapshotDir: "", outDir: ".", log: () => undefined },
    );
    const entity = desc.entities.item;
    const variants = desc.variants.item;
    if (!entity || !variants) throw new Error("item descriptors are missing");

    expect(buildDDL(entity, variants)).toContain('"minimumSkill" INTEGER');
  });

  it("emits item_tag_refs child table for entities with tags", () => {
    const ddl = buildDDL(item, []);
    expect(ddl).toContain('CREATE TABLE "item_tag_refs"');
    expect(ddl).toContain('PRIMARY KEY ("item_id", "tag")');
  });
});
