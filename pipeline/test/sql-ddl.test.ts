import { describe, it, expect } from "bun:test";
import { buildDDL } from "$pipeline/sql/ddl";
import type { EntityDescriptor, VariantDescriptor } from "$pipeline/types";

const item: EntityDescriptor = {
  id: "item",
  label: { singular: "Item", plural: "Items" },
  extraction: { root: "x" },
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

  it("emits item_tag_refs child table for entities with tags", () => {
    const ddl = buildDDL(item, []);
    expect(ddl).toContain('CREATE TABLE "item_tag_refs"');
    expect(ddl).toContain('PRIMARY KEY ("item_id", "tag")');
  });
});
