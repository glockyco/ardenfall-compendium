import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { afterEach, describe, expect, it } from "bun:test";
import sharp from "sharp";
import { emitBasemapReadModels, ingestBasemaps } from "../src/map/basemap";
import { SITE_METADATA_DDL } from "../src/sql/site-metadata-ddl";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

async function captureFixture(
  options: { missing?: boolean; gameVersion?: string; gridOffset?: number } = {},
) {
  const root = mkdtempSync(join(tmpdir(), "basemap-"));
  roots.push(root);
  const assetDir = join(root, "assets", "map", "overworld");
  mkdirSync(assetDir, { recursive: true });
  const png = await sharp({
    create: { width: 16, height: 16, channels: 4, background: { r: 40, g: 90, b: 20, alpha: 1 } },
  })
    .png()
    .toBuffer();
  const hash = createHash("sha256").update(png).digest("hex");
  const path = `assets/map/overworld/${hash}.png`;
  writeFileSync(join(root, path), png);
  const offset = options.gridOffset ?? 0;
  const tiles = [
    { cellX: offset, cellY: offset, hash, path, bytes: png.length, empty: false },
    { cellX: offset + 1, cellY: offset, hash: "", path: "", bytes: 0, empty: true },
    { cellX: offset, cellY: offset + 1, hash, path, bytes: png.length, empty: false },
    ...(!options.missing
      ? [
          {
            cellX: offset + 1,
            cellY: offset + 1,
            hash,
            path,
            bytes: png.length,
            empty: false,
          },
        ]
      : []),
  ];
  writeFileSync(
    join(root, "map-capture-overworld.json"),
    JSON.stringify({
      inputs: {
        mapId: "overworld",
        gameVersion: options.gameVersion ?? "demo-build",
        gridOffsetX: offset,
        gridOffsetY: offset,
        gridSizeX: 2,
        gridSizeY: 2,
        cellSize: 8,
        pixelsPerCell: 16,
        pixelsPerUnit: 2,
        minCellX: offset,
        minCellY: offset,
        maxCellX: offset + 1,
        maxCellY: offset + 1,
      },
      tiles,
    }),
  );
  return root;
}

describe("basemap ingest", () => {
  it("converts tiles, records empty positions, and builds the pyramid", async () => {
    const root = await captureFixture();
    const output = await ingestBasemaps(root, "demo-build");
    expect(output.basemaps).toHaveLength(1);
    const map = output.basemaps[0]!;

    expect(map.minZoom).toBe(0);
    expect(map.maxZoom).toBe(1);
    expect(map.tiles).toHaveLength(5);
    expect(map.tiles).toContainEqual({
      mapId: "overworld",
      zoom: 1,
      tileX: 1,
      tileY: 0,
      assetHash: null,
      byteSize: 0,
      empty: true,
    });
    expect(map.tiles.find((tile) => tile.zoom === 0)?.assetHash).toMatch(/^[a-f0-9]{64}$/);
    const emittedHashes = new Set(output.assets.map((asset) => asset.hash));
    for (const tile of map.tiles.filter((entry) => !entry.empty)) {
      expect(emittedHashes.has(tile.assetHash!)).toBe(true);
    }
    for (const asset of output.assets) {
      expect(createHash("sha256").update(asset.bytes).digest("hex")).toBe(asset.hash);
    }
  });

  it("stitches north-up cells without changing world axes", async () => {
    const root = mkdtempSync(join(tmpdir(), "basemap-axis-"));
    roots.push(root);
    mkdirSync(join(root, "assets", "map", "overworld"), { recursive: true });
    const colors = [
      { cellX: 0, cellY: 0, color: { r: 220, g: 20, b: 20, alpha: 1 } },
      { cellX: 1, cellY: 0, color: { r: 20, g: 220, b: 20, alpha: 1 } },
      { cellX: 0, cellY: 1, color: { r: 20, g: 20, b: 220, alpha: 1 } },
      { cellX: 1, cellY: 1, color: { r: 220, g: 220, b: 20, alpha: 1 } },
    ];
    const tiles = [];
    for (const entry of colors) {
      const png = await sharp({
        create: { width: 64, height: 64, channels: 4, background: entry.color },
      })
        .png()
        .toBuffer();
      const hash = createHash("sha256").update(png).digest("hex");
      const path = `assets/map/overworld/${hash}.png`;
      writeFileSync(join(root, path), png);
      tiles.push({ ...entry, hash, path, bytes: png.length, empty: false, authored: true });
    }
    writeFileSync(
      join(root, "map-capture-overworld.json"),
      JSON.stringify({
        inputs: {
          mapId: "overworld",
          gameVersion: "demo-build",
          gridOffsetX: 0,
          gridOffsetY: 0,
          gridSizeX: 2,
          gridSizeY: 2,
          cellSize: 64,
          pixelsPerCell: 64,
          pixelsPerUnit: 1,
          minCellX: 0,
          minCellY: 0,
          maxCellX: 1,
          maxCellY: 1,
        },
        tiles,
      }),
    );

    const output = await ingestBasemaps(root, "demo-build");
    const parent = output.basemaps[0]!.tiles.find((tile) => tile.zoom === -1)!;
    const asset = output.assets.find((candidate) => candidate.hash === parent.assetHash)!;
    const { data, info } = await sharp(asset.bytes)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const pixel = (x: number, y: number) => [
      ...data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3),
    ];

    const expectPixel = (actual: number[], expected: number[]) => {
      for (let channel = 0; channel < 3; channel++) {
        expect(Math.abs(actual[channel]! - expected[channel]!)).toBeLessThanOrEqual(3);
      }
    };
    expectPixel(pixel(8, 8), [20, 20, 220]);
    expectPixel(pixel(56, 8), [220, 220, 20]);
    expectPixel(pixel(8, 56), [220, 20, 20]);
    expectPixel(pixel(56, 56), [20, 220, 20]);
  });

  it("terminates the pyramid across the global negative-coordinate boundary", async () => {
    const root = await captureFixture({ gridOffset: -1 });
    const output = await ingestBasemaps(root, "demo-build");
    const rootTiles = output.basemaps[0]!.tiles.filter((tile) => tile.zoom === 0);

    expect(rootTiles).toHaveLength(4);
    expect(rootTiles.map((tile) => `${tile.tileX},${tile.tileY}`).sort()).toEqual([
      "-1,-1",
      "-1,0",
      "0,-1",
      "0,0",
    ]);
  });

  it("rejects an unresolved position", async () => {
    const root = await captureFixture({ missing: true });
    await expect(ingestBasemaps(root, "demo-build")).rejects.toThrow("unresolved position 0/1/1");
  });

  it("rejects a capture from another game build", async () => {
    const root = await captureFixture({ gameVersion: "other-build" });
    await expect(ingestBasemaps(root, "demo-build")).rejects.toThrow(
      "differs from snapshot 'demo-build'",
    );
  });

  it("rejects a published placement outside capture bounds", () => {
    const db = new Database(":memory:");
    db.exec(SITE_METADATA_DDL);
    db.exec(`CREATE TABLE map_points (
      id TEXT PRIMARY KEY, map_id TEXT, map_x REAL NOT NULL, map_y REAL NOT NULL
    );`);
    db.exec(`CREATE TABLE map_volumes (
      id TEXT PRIMARY KEY, map_id TEXT, geometry_json TEXT NOT NULL
    );`);
    db.exec(`INSERT INTO map_points VALUES ('outside', 'overworld', 301, 0);`);

    expect(() =>
      emitBasemapReadModels(db, [
        {
          mapId: "overworld",
          minX: 0,
          minY: 0,
          maxX: 300,
          maxY: 300,
          pixelsPerUnit: 16 / 150,
          cellSize: 150,
          minZoom: 0,
          maxZoom: 0,
          tileSize: 16,
          indexRef: "map_tiles",
          gameVersion: "demo-build",
          tiles: [],
        },
      ]),
    ).toThrow("placement 'outside' lies outside");
    db.close();
  });
});
