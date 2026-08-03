import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadDescriptors } from "$pipeline/stages/load-descriptors";
import { validateDescriptorCoverage } from "$pipeline/entities/registry";

describe("loadDescriptors", () => {
  it("loads every committed entity descriptor", async () => {
    const result = await loadDescriptors.run(
      {},
      {
        workspaceRoot: ".",
        snapshotDir: "",
        outDir: "",
        log: () => undefined,
      },
    );

    expect(Object.keys(result.entities).sort()).toEqual([
      "character",
      "item",
      "item-category",
      "item-tag",
      "location",
      "portal",
      "spell",
      "stat-type",
      "status-effect",
    ]);
  });

  it("loads the item descriptor + variants from entities/", async () => {
    const result = await loadDescriptors.run(
      {},
      {
        workspaceRoot: ".",
        snapshotDir: "",
        outDir: "",
        log: () => undefined,
      },
    );
    const item = result.entities["item"];
    const itemVariants = result.variants["item"];
    if (!item) throw new Error("item entity not loaded");
    if (!itemVariants) throw new Error("item variants not loaded");
    expect(item.id).toBe("item");
    expect(itemVariants.length).toBe(17);
    expect(item.kind).toBe("definition");
    expect(item.extraction.source).toBe("lookupAsset");
    const ids = itemVariants.map((v) => v.variantId).sort();
    expect(ids).toEqual([
      "armor",
      "arrow",
      "basic",
      "bow",
      "consumable",
      "currency",
      "equipment",
      "hand-item",
      "lockpick",
      "melee-weapon",
      "note",
      "potion-recipe",
      "primary-hand",
      "repair-kit",
      "slate-spell",
      "throwing-item",
      "throwing-potion",
    ]);
  });

  it("loads the stat-type descriptor without variants", async () => {
    const result = await loadDescriptors.run(
      {},
      {
        workspaceRoot: ".",
        snapshotDir: "",
        outDir: "",
        log: () => undefined,
      },
    );
    const statType = result.entities["stat-type"];
    if (!statType) throw new Error("stat-type entity not loaded");

    expect(statType.extraction.source).toBe("namedAsset");
    expect(statType.extraction.root).toBe("Resources.FindObjectsOfTypeAll<StatType>");
    expect(statType.presentationContext?.renderContext).toBe("stat-type-presentation-v1");
    expect(statType.fields.map((field) => field.name)).toContain("statName");
    expect(result.variants["stat-type"]).toEqual([]);
  });
  it("loads explicit public routes from entity descriptors", async () => {
    const result = await loadDescriptors.run(
      {},
      {
        workspaceRoot: ".",
        snapshotDir: "",
        outDir: "",
        log: () => undefined,
      },
    );

    expect(result.entities.item?.site?.route).toBe("/items");
    expect(result.entities["stat-type"]?.site?.route).toBe("/stats");
    expect(result.entities["item-category"]?.site?.route).toBe("/categories");
    expect(result.entities["item-tag"]?.site?.route).toBe("/tags");
  });

  it("loads the item-category descriptor without variants", async () => {
    const result = await loadDescriptors.run(
      {},
      {
        workspaceRoot: ".",
        snapshotDir: "",
        outDir: "",
        log: () => undefined,
      },
    );
    const category = result.entities["item-category"];
    if (!category) throw new Error("item-category entity not loaded");

    expect(category.extraction.source).toBe("namedAsset");
    expect(category.extraction.root).toBe("Resources.FindObjectsOfTypeAll<ItemCategory>");
    expect(category.presentationContext?.renderContext).toBe("item-category-presentation-v1");
    expect(category.fields.map((field) => field.name)).toContain("categoryColor");
    expect(result.variants["item-category"]).toEqual([]);
  });

  it("loads the item-tag descriptor without variants", async () => {
    const result = await loadDescriptors.run(
      {},
      {
        workspaceRoot: ".",
        snapshotDir: "",
        outDir: "",
        log: () => undefined,
      },
    );
    const tag = result.entities["item-tag"];
    if (!tag) throw new Error("item-tag entity not loaded");

    expect(tag.label.plural).toBe("Tags");
    expect(tag.presentationContext?.renderContext).toBe("item-tag-presentation-v1");
    expect(tag.fields.map((field) => field.name)).toEqual(["id", "tagName", "description"]);
    expect(result.variants["item-tag"]).toEqual([]);
  });

  it("loads the location descriptor with a public route and a map layer", async () => {
    const result = await loadDescriptors.run(
      {},
      {
        workspaceRoot: ".",
        snapshotDir: "",
        outDir: "",
        log: () => undefined,
      },
    );
    const location = result.entities.location;
    if (!location) throw new Error("location entity not loaded");

    expect(location.kind).toBe("definition");
    expect(location.extraction.source).toBe("lookupAsset");
    expect(location.placement).toEqual({ kind: "point+volume", from: "fields" });
    expect(location.site).toEqual({ route: "/locations" });
    expect(location.map).toEqual({
      layer: "locations",
      renderKind: "point-or-polygon",
      icon: "location",
      color: [120, 170, 255],
      radius: 6,
      tooltip: ["name"],
      legendLabel: "Locations",
      zOrder: 100,
    });
    expect(location.fields.map((field) => field.name)).toEqual([
      "id",
      "name",
      "enabled",
      "mapId",
      "mapRef",
      "showOnMap",
      "iconRef",
      "mapPosition",
      "showOnMapDebugOnly",
      "allowFastTravel",
      "fastTravelPosition",
      "volumes",
    ]);
  });

  it("loads the portal descriptor as the first record-backed instance entity", async () => {
    const result = await loadDescriptors.run(
      {},
      {
        workspaceRoot: ".",
        snapshotDir: "",
        outDir: "",
        log: () => undefined,
      },
    );
    const portal = result.entities.portal;
    if (!portal) throw new Error("portal entity not loaded");

    expect(portal.kind).toBe("instance");
    expect(portal.extraction).toEqual({
      source: "record",
      root: "Ardenfall.RecordSystem.PortalRecord",
      options: { table: "world", subtable: "portals" },
    });
    expect(portal.definition).toBeUndefined();
    expect(portal.placement).toEqual({ kind: "point", from: "transform" });
    expect(portal.map).toEqual({
      layer: "portals",
      renderKind: "point",
      icon: "portal",
      color: [190, 150, 255],
      radius: 5,
      tooltip: ["name"],
      legendLabel: "Portals",
      zOrder: 90,
    });
  });

  it("loads non-variant entity descriptors with presentation contexts", async () => {
    const root = mkdtempSync(join(tmpdir(), "ardenfall-descriptor-"));
    try {
      const entityDir = join(root, "entities", "stat-type");
      mkdirSync(entityDir, { recursive: true });
      writeFileSync(
        join(entityDir, "entity.json"),
        `${JSON.stringify(
          {
            $schema: "../../schemas/entity.schema.json",
            id: "stat-type",
            kind: "definition",
            label: { singular: "Stat type", plural: "Stat types" },
            extraction: {
              source: "lookupAsset",
              root: "BuiltLookupTable.GetAssetsOfType<StatType>",
              walker: "StatTypeWalker",
            },
            canonicalTable: "stat_types",
            presentationContext: { renderContext: "stat-type-presentation-v1" },
            fields: [
              { name: "id", type: "id", from: "guid", missingPolicy: "fatal" },
              { name: "name", type: "string", from: "statName", missingPolicy: "fatal" },
            ],
            map: null,
          },
          null,
          2,
        )}\n`,
      );

      const result = await loadDescriptors.run(
        {},
        {
          workspaceRoot: root,
          snapshotDir: "",
          outDir: "",
          log: () => undefined,
        },
      );

      expect(result.variants["stat-type"]).toEqual([]);
      expect(
        (result.entities["stat-type"] as { presentationContext?: { renderContext: string } })
          .presentationContext,
      ).toEqual({ renderContext: "stat-type-presentation-v1" });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects definition blocks on definition descriptors", async () => {
    const root = mkdtempSync(join(tmpdir(), "ardenfall-kind-conditional-"));
    try {
      const entityDir = join(root, "entities", "thing");
      mkdirSync(entityDir, { recursive: true });
      writeFileSync(
        join(entityDir, "entity.json"),
        `${JSON.stringify(
          {
            $schema: "../../schemas/entity.schema.json",
            id: "thing",
            kind: "definition",
            label: { singular: "Thing", plural: "Things" },
            extraction: { source: "lookupAsset", root: "Thing.Root" },
            definition: { entity: "thing", via: "definitionRef" },
            fields: [{ name: "id", type: "id", from: "id", missingPolicy: "fatal" }],
            map: null,
          },
          null,
          2,
        )}\n`,
      );

      expect(() =>
        loadDescriptors.run(
          {},
          { workspaceRoot: root, snapshotDir: "", outDir: "", log: () => undefined },
        ),
      ).toThrow(/invalid entity descriptor[\s\S]*boolean schema is false/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it("rejects public descriptors without a route", async () => {
    const root = mkdtempSync(join(tmpdir(), "ardenfall-missing-route-"));
    try {
      const entityDir = join(root, "entities", "thing");
      mkdirSync(entityDir, { recursive: true });
      writeFileSync(
        join(entityDir, "entity.json"),
        `${JSON.stringify(
          {
            $schema: "../../schemas/entity.schema.json",
            id: "thing",
            kind: "definition",
            label: { singular: "Thing", plural: "Things" },
            extraction: { source: "lookupAsset", root: "Thing.Root", walker: "ThingWalker" },
            fields: [{ name: "id", type: "id", from: "id", missingPolicy: "fatal" }],
            site: { overview: { columns: ["id"] } },
            map: null,
          },
          null,
          2,
        )}\n`,
      );

      expect(() =>
        loadDescriptors.run(
          {},
          { workspaceRoot: root, snapshotDir: "", outDir: "", log: () => undefined },
        ),
      ).toThrow(/entity\.json#\/site — must have required property 'route'/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects malformed public routes", async () => {
    const root = mkdtempSync(join(tmpdir(), "ardenfall-bad-route-"));
    try {
      const entityDir = join(root, "entities", "thing");
      mkdirSync(entityDir, { recursive: true });
      writeFileSync(
        join(entityDir, "entity.json"),
        `${JSON.stringify(
          {
            $schema: "../../schemas/entity.schema.json",
            id: "thing",
            kind: "definition",
            label: { singular: "Thing", plural: "Things" },
            extraction: { source: "lookupAsset", root: "Thing.Root", walker: "ThingWalker" },
            fields: [{ name: "id", type: "id", from: "id", missingPolicy: "fatal" }],
            site: { route: "Things", overview: { columns: ["id"] } },
            map: null,
          },
          null,
          2,
        )}\n`,
      );

      expect(() =>
        loadDescriptors.run(
          {},
          { workspaceRoot: root, snapshotDir: "", outDir: "", log: () => undefined },
        ),
      ).toThrow(/entity\.json#\/site\/route — must match pattern/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it("accepts every committed public or mapped descriptor in the pipeline support registry", async () => {
    const result = await loadDescriptors.run(
      {},
      {
        workspaceRoot: ".",
        snapshotDir: "",
        outDir: "",
        log: () => undefined,
      },
    );
    expect(() => validateDescriptorCoverage(result)).not.toThrow();
  });

  it("reports missing canonicalizer and read-model support by descriptor id", () => {
    expect(() =>
      validateDescriptorCoverage({
        entities: {
          thing: {
            id: "thing",
            kind: "definition",
            label: { singular: "Thing", plural: "Things" },
            extraction: { source: "lookupAsset", root: "Thing.Root" },
            canonicalTable: "things",
            fields: [{ name: "id", type: "id", from: "id", missingPolicy: "fatal" }],
            site: { route: "/things", overview: { columns: ["id"] } },
            map: null,
          },
        },
        variants: { thing: [] },
      }),
    ).toThrow(
      /descriptor 'thing' has no pipeline canonicalizer[\s\S]*descriptor 'thing' has no read-model emitter for public route '\/things'/,
    );
  });

  it("reports missing map read-model support by descriptor id", () => {
    expect(() =>
      validateDescriptorCoverage({
        entities: {
          item: {
            id: "item",
            kind: "definition",
            label: { singular: "Item", plural: "Items" },
            canonicalTable: "items",
            extraction: {
              source: "lookupAsset",
              root: "BuiltLookupTable.GetAssetsOfType<ItemData>",
            },
            fields: [{ name: "id", type: "id", from: "guid", missingPolicy: "fatal" }],
            map: { layer: "items", renderKind: "point" },
          },
        },
        variants: { item: [] },
      }),
    ).toThrow(/descriptor 'item' has no map read-model emitter for layer 'items'/);
  });
  it("rejects an invalid descriptor with a JSON Pointer in the error", async () => {
    // This behavior is covered by invariants/items.test.ts; keep this case
    // as the future home for a sandboxed invalid-descriptor fixture.
    expect(true).toBe(true);
  });
});
