import { describe, expect, it } from "bun:test";
import { buildEntityLayerSpecs, type LayerSpec } from "../src/lib/map/layer-spec";
import type { MapLayerConfig, MapPointRow, MapVolumeRow } from "../src/lib/map/types";

const layer: MapLayerConfig = {
  layerId: "locations",
  entityType: "location",
  renderKind: "point-or-polygon",
  sourceTables: ["map_points", "map_volumes"],
  fillColor: [120, 170, 255, 255],
  radius: 6,
  icon: "location",
  tooltipFields: ["name"],
  filters: [],
  legendLabel: "Locations",
  zOrder: 0,
};

const point = (id: string, over: Partial<MapPointRow> = {}): MapPointRow => ({
  id,
  entityId: "location",
  instanceId: id,
  layerId: "locations",
  mapId: "ardenfall",
  position: [1, 2, 0],
  elevation: 0,
  name: id,
  tooltip: id,
  debugOnly: false,
  fastTravel: false,
  nodeShortId: id,
  ...over,
});

const volume: MapVolumeRow = {
  id: "v1",
  layerId: "locations",
  entityId: "location",
  instanceId: "town",
  mapId: "ardenfall",
  ring: [
    [0, 0],
    [4, 0],
    [4, 4],
    [0, 4],
    [0, 0],
  ],
  elevationMin: 0,
  elevationMax: 2,
  name: "town",
};

const baseUi = { hiddenLayers: [] as string[], showDebug: false, fastTravelOnly: false };

const pointData = (specs: LayerSpec[]): MapPointRow[] =>
  specs.find((s) => s.kind === "scatterplot")!.data as MapPointRow[];

describe("buildEntityLayerSpecs", () => {
  it("expands point-or-polygon into a polygon spec and a scatterplot spec", () => {
    const specs = buildEntityLayerSpecs(layer, [point("a")], [volume], baseUi);
    expect(specs.map((s) => s.kind)).toEqual(["polygon", "scatterplot"]);
    const scatter = specs.find((s) => s.kind === "scatterplot")!;
    expect(scatter.fillColor).toEqual([120, 170, 255, 255]);
    expect(scatter.radius).toBe(6);
  });

  it("hides debug-only points unless showDebug is set", () => {
    const rows = [point("a"), point("b", { debugOnly: true })];
    expect(pointData(buildEntityLayerSpecs(layer, rows, [], baseUi)).map((r) => r.id)).toEqual([
      "a",
    ]);
    expect(
      pointData(buildEntityLayerSpecs(layer, rows, [], { ...baseUi, showDebug: true })).map(
        (r) => r.id,
      ),
    ).toEqual(["a", "b"]);
  });

  it("keeps only fast-travel points when fastTravelOnly is set", () => {
    const rows = [point("a", { fastTravel: true }), point("b", { fastTravel: false })];
    const specs = buildEntityLayerSpecs(layer, rows, [], { ...baseUi, fastTravelOnly: true });
    expect(pointData(specs).map((r) => r.id)).toEqual(["a"]);
  });

  it("sets visible=false when the layer is hidden, without dropping data", () => {
    const specs = buildEntityLayerSpecs(layer, [point("a")], [volume], {
      ...baseUi,
      hiddenLayers: ["locations"],
    });
    expect(specs.every((s) => s.visible === false)).toBe(true);
    expect(pointData(specs).length).toBe(1);
  });

  it("throws on an unknown render kind", () => {
    expect(() =>
      buildEntityLayerSpecs(
        { ...layer, renderKind: "hologram" as MapLayerConfig["renderKind"] },
        [point("a")],
        [],
        baseUi,
      ),
    ).toThrow(/unknown render kind/i);
  });
});
