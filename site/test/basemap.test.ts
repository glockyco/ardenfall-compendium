import { describe, expect, it } from "bun:test";
import {
  basemapTileIndex,
  composeMapLayers,
  deckTileSize,
  visibleBasemapTiles,
} from "../src/lib/map/basemap";
import type { MapBasemap } from "../src/lib/map/types";

const basemap: MapBasemap = {
  bounds: { minX: -300, minY: -1200, maxX: 0, maxY: -900 },
  pixelsPerUnit: 512 / 150,
  cellSize: 150,
  minZoom: 1,
  maxZoom: 2,
  tileSize: 512,
  indexRef: "map_tiles",
  tiles: [
    { zoom: 2, x: -2, y: -8, assetUrl: "/assets/a.webp", byteSize: 12, empty: false },
    { zoom: 2, x: -1, y: -8, assetUrl: null, byteSize: 0, empty: true },
    { zoom: 1, x: -1, y: -4, assetUrl: "/assets/parent.webp", byteSize: 16, empty: false },
  ],
};

describe("basemap rendering contract", () => {
  it("resolves a tile request through the generated index", () => {
    const index = basemapTileIndex(basemap);
    expect(index.get("2/-2/-8")?.assetUrl).toBe("/assets/a.webp");
    expect(index.get("2/-1/-8")?.empty).toBe(true);
    expect(index.get("2/0/0")).toBeUndefined();
  });

  it("selects visible tiles and falls back from an empty finest position", () => {
    expect(
      visibleBasemapTiles(basemap, {
        target: [-75, -1125, 0],
        zoom: 2,
        width: 100,
        height: 100,
      }),
    ).toEqual([
      {
        tile: basemap.tiles[2]!,
        bounds: [-300, -1200, 0, -900],
      },
    ]);
  });

  it("uses the captured cell span for deck's global lattice", () => {
    expect(deckTileSize(basemap)).toBe(600);
  });

  it("paints imagery before markers and accepts no imagery", () => {
    expect(composeMapLayers(["basemap"], ["areas", "markers"])).toEqual([
      "basemap",
      "areas",
      "markers",
    ]);
    expect(composeMapLayers([], ["markers"])).toEqual(["markers"]);
  });
});
