import { describe, expect, it } from "bun:test";
import { validateDescriptorFields } from "$pipeline/stages/validate-descriptor-fields";
import type { EntityDescriptor, VariantDescriptor } from "$pipeline/types";
import type { LoadSnapshotOutput } from "$pipeline/stages/load-snapshot";
import type { LoadDescriptorsOutput } from "$pipeline/stages/load-descriptors";

const entity = (id: string, fields: string[]): EntityDescriptor => ({
  id,
  kind: "definition",
  label: { singular: id, plural: `${id}s` },
  extraction: { source: "record", root: id },
  canonicalTable: `${id}s`,
  fields: fields.map((name) => ({ name, type: "string", from: name })),
});

const snapshot = (entityId: string, rows: { id: string; fields: Record<string, unknown> }[]) =>
  ({
    envelopes: { [entityId]: { entityId, schemaVersion: 1, rows } },
  }) as unknown as LoadSnapshotOutput;

const stageCtx = { workspaceRoot: ".", snapshotDir: "", outDir: "", log: () => undefined };

const descriptors = (
  entities: Record<string, EntityDescriptor>,
  variants: Record<string, VariantDescriptor[]> = {},
) => ({ entities, variants }) as LoadDescriptorsOutput;

describe("validateDescriptorFields", () => {
  it("fails with entity, undeclared field, and sample row", () => {
    expect(() =>
      validateDescriptorFields.run(
        {
          "load-descriptors": descriptors({ thing: entity("thing", ["id"]) }),
          "load-snapshot": snapshot("thing", [{ id: "row-7", fields: { id: "row-7", leaked: 1 } }]),
        },
        stageCtx,
      ),
    ).toThrow("snapshot entity 'thing' emits undeclared field 'leaked' (sample row 'row-7')");
  });

  it("accepts fields declared by an item variant", () => {
    const item = entity("item", ["id"]);
    const variant: VariantDescriptor = {
      variantId: "equipment",
      label: "Equipment",
      unityType: "Game.Equipment",
      canonicalTable: "item_equipment",
      fields: [{ name: "slot", type: "string", from: "slot" }],
    };

    expect(() =>
      validateDescriptorFields.run(
        {
          "load-descriptors": descriptors({ item }, { item: [variant] }),
          "load-snapshot": snapshot("item", [
            { id: "item-1", fields: { id: "item-1", slot: "head" } },
          ]),
        },
        stageCtx,
      ),
    ).not.toThrow();
  });
});
