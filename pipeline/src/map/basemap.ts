import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import type { Database } from "bun:sqlite";

export interface CaptureRecord {
  inputs: {
    mapId: string;
    gameVersion: string;
    gridOffsetX: number;
    gridOffsetY: number;
    gridSizeX: number;
    gridSizeY: number;
    cellSize: number;
    pixelsPerCell: number;
    pixelsPerUnit: number;
    minCellX: number;
    minCellY: number;
    maxCellX: number;
    maxCellY: number;
  };
  tiles: Array<{
    cellX: number;
    cellY: number;
    hash: string;
    path: string;
    bytes: number;
    empty?: boolean;
  }>;
}

export interface BasemapTile {
  mapId: string;
  zoom: number;
  tileX: number;
  tileY: number;
  assetHash: string | null;
  byteSize: number;
  empty: boolean;
}

export interface BasemapMetadata {
  mapId: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  pixelsPerUnit: number;
  cellSize: number;
  minZoom: number;
  maxZoom: number;
  tileSize: number;
  indexRef: string;
  gameVersion: string;
  tiles: BasemapTile[];
}

export interface BasemapAsset {
  hash: string;
  bytes: Uint8Array;
}

export interface BasemapIngestOutput {
  basemaps: BasemapMetadata[];
  assets: BasemapAsset[];
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function captureFiles(snapshotDir: string): string[] {
  return readdirSync(snapshotDir)
    .filter((name: string) => /^map-capture-.+\.json$/.test(name))
    .sort((left: string, right: string) => left.localeCompare(right));
}

function assertTilePath(path: string): void {
  if (!path.startsWith("assets/") || !path.endsWith(".png") || path.includes("..")) {
    throw new Error(`invalid map capture tile path: ${path}`);
  }
}

function assetFromWebp(bytes: Uint8Array): BasemapAsset {
  return { hash: sha256(bytes), bytes };
}

async function makeParent(
  children: Array<{ input: Uint8Array; left: number; top: number }>,
  tileSize: number,
): Promise<Uint8Array> {
  const canvasSize = tileSize * 2;
  const composed = await sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(
      children.map((child) => ({
        input: Buffer.from(child.input),
        left: child.left,
        top: child.top,
      })),
    )
    .png()
    .toBuffer();
  return sharp(composed).resize(tileSize, tileSize).webp({ quality: 82 }).toBuffer();
}

function addEmptyPositions(
  tiles: BasemapTile[],
  mapId: string,
  zoom: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): void {
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (tiles.some((tile) => tile.zoom === zoom && tile.tileX === x && tile.tileY === y))
        continue;
      tiles.push({ mapId, zoom, tileX: x, tileY: y, assetHash: null, byteSize: 0, empty: true });
    }
  }
}

export async function ingestBasemaps(
  snapshotDir: string,
  expectedGameVersion: string | undefined,
): Promise<BasemapIngestOutput> {
  const basemaps: BasemapMetadata[] = [];
  const assets: BasemapAsset[] = [];
  for (const fileName of captureFiles(snapshotDir)) {
    const capture = JSON.parse(readFileSync(join(snapshotDir, fileName), "utf8")) as CaptureRecord;
    if (!capture.inputs?.mapId) throw new Error(`map capture '${fileName}' has no map id`);
    if (expectedGameVersion && capture.inputs.gameVersion !== expectedGameVersion) {
      throw new Error(
        `map capture '${capture.inputs.mapId}' game build '${capture.inputs.gameVersion}' differs from snapshot '${expectedGameVersion}'`,
      );
    }
    const tileSize = capture.inputs.pixelsPerCell;
    if (!Number.isInteger(tileSize) || tileSize <= 0) {
      throw new Error(`map capture '${capture.inputs.mapId}' has invalid tile size`);
    }
    const declaredMaxX = capture.inputs.gridOffsetX + capture.inputs.gridSizeX - 1;
    const declaredMaxY = capture.inputs.gridOffsetY + capture.inputs.gridSizeY - 1;
    if (
      capture.inputs.minCellX !== capture.inputs.gridOffsetX ||
      capture.inputs.minCellY !== capture.inputs.gridOffsetY ||
      capture.inputs.maxCellX !== declaredMaxX ||
      capture.inputs.maxCellY !== declaredMaxY
    ) {
      throw new Error(
        `map capture '${capture.inputs.mapId}' does not cover its declared grid ` +
          `[${capture.inputs.gridOffsetX},${capture.inputs.gridOffsetY}]..[${declaredMaxX},${declaredMaxY}]`,
      );
    }

    const capturePositions = new Map<string, CaptureRecord["tiles"][number]>();
    for (const tile of capture.tiles) {
      const key = `${tile.cellX},${tile.cellY}`;
      if (capturePositions.has(key)) throw new Error(`duplicate map capture position ${key}`);
      capturePositions.set(key, tile);
    }
    for (let y = capture.inputs.minCellY; y <= capture.inputs.maxCellY; y++) {
      for (let x = capture.inputs.minCellX; x <= capture.inputs.maxCellX; x++) {
        if (!capturePositions.has(`${x},${y}`)) {
          throw new Error(
            `map capture '${capture.inputs.mapId}' has unresolved position 0/${x}/${y}`,
          );
        }
      }
    }

    const byPosition = new Map<string, { bytes: Uint8Array; sourceHash: string }>();
    for (const tile of capture.tiles) {
      const key = `${tile.cellX},${tile.cellY}`;
      if (tile.empty) continue;
      assertTilePath(tile.path);
      const sourcePath = join(snapshotDir, tile.path);
      if (!existsSync(sourcePath)) throw new Error(`missing map capture tile: ${tile.path}`);
      const png = readFileSync(sourcePath);
      const sourceHash = sha256(png);
      if (sourceHash !== tile.hash) {
        throw new Error(`map capture tile hash mismatch for ${tile.path}`);
      }
      byPosition.set(key, { bytes: png, sourceHash });
    }

    const outputAssets = new Map<string, BasemapAsset>();
    const tiles: BasemapTile[] = [];
    const maxZoom = Math.ceil(Math.log2(capture.inputs.pixelsPerUnit));
    const finest = new Map<string, Uint8Array>();
    for (let y = capture.inputs.minCellY; y <= capture.inputs.maxCellY; y++) {
      for (let x = capture.inputs.minCellX; x <= capture.inputs.maxCellX; x++) {
        const source = byPosition.get(`${x},${y}`);
        if (!source) continue;
        const webp = await sharp(source.bytes).webp({ quality: 82 }).toBuffer();
        const asset = assetFromWebp(webp);
        outputAssets.set(asset.hash, asset);
        finest.set(`${x},${y}`, source.bytes);
        tiles.push({
          mapId: capture.inputs.mapId,
          zoom: maxZoom,
          tileX: x,
          tileY: y,
          assetHash: asset.hash,
          byteSize: webp.length,
          empty: false,
        });
      }
    }
    addEmptyPositions(
      tiles,
      capture.inputs.mapId,
      maxZoom,
      capture.inputs.minCellX,
      capture.inputs.minCellY,
      capture.inputs.maxCellX,
      capture.inputs.maxCellY,
    );

    const minZoom =
      maxZoom - Math.ceil(Math.log2(Math.max(capture.inputs.gridSizeX, capture.inputs.gridSizeY)));
    let currentZoom = maxZoom;
    let currentMinX = capture.inputs.minCellX;
    let currentMinY = capture.inputs.minCellY;
    let currentMaxX = capture.inputs.maxCellX;
    let currentMaxY = capture.inputs.maxCellY;
    let current = finest;
    while (currentZoom > minZoom) {
      const parentZoom = currentZoom - 1;
      const parentMinX = Math.floor(currentMinX / 2);
      const parentMinY = Math.floor(currentMinY / 2);
      const parentMaxX = Math.floor(currentMaxX / 2);
      const parentMaxY = Math.floor(currentMaxY / 2);
      const parent = new Map<string, Uint8Array>();
      for (let y = parentMinY; y <= parentMaxY; y++) {
        for (let x = parentMinX; x <= parentMaxX; x++) {
          const children: Array<{ input: Uint8Array; left: number; top: number }> = [];
          for (let childY = 0; childY < 2; childY++) {
            for (let childX = 0; childX < 2; childX++) {
              const input = current.get(`${x * 2 + childX},${y * 2 + childY}`);
              if (input) {
                children.push({
                  input,
                  left: childX * tileSize,
                  top: (1 - childY) * tileSize,
                });
              }
            }
          }
          if (children.length === 0) continue;
          const webp = await makeParent(children, tileSize);
          const asset = assetFromWebp(webp);
          outputAssets.set(asset.hash, asset);
          parent.set(`${x},${y}`, webp);
          tiles.push({
            mapId: capture.inputs.mapId,
            zoom: parentZoom,
            tileX: x,
            tileY: y,
            assetHash: asset.hash,
            byteSize: webp.length,
            empty: false,
          });
        }
      }
      addEmptyPositions(
        tiles,
        capture.inputs.mapId,
        parentZoom,
        parentMinX,
        parentMinY,
        parentMaxX,
        parentMaxY,
      );
      currentZoom = parentZoom;
      currentMinX = parentMinX;
      currentMinY = parentMinY;
      currentMaxX = parentMaxX;
      currentMaxY = parentMaxY;
      current = parent;
    }

    basemaps.push({
      mapId: capture.inputs.mapId,
      minX: capture.inputs.gridOffsetX * capture.inputs.cellSize,
      minY: capture.inputs.gridOffsetY * capture.inputs.cellSize,
      maxX: (capture.inputs.gridOffsetX + capture.inputs.gridSizeX) * capture.inputs.cellSize,
      maxY: (capture.inputs.gridOffsetY + capture.inputs.gridSizeY) * capture.inputs.cellSize,
      pixelsPerUnit: capture.inputs.pixelsPerUnit,
      cellSize: capture.inputs.cellSize,
      minZoom,
      maxZoom,
      tileSize,
      indexRef: "map_tiles",
      gameVersion: capture.inputs.gameVersion,
      tiles,
    });
    assets.push(...outputAssets.values());
  }

  return { basemaps, assets };
}

export function emitBasemapReadModels(db: Database, basemaps: readonly BasemapMetadata[]): void {
  const insertMap = db.prepare(`INSERT INTO map_basemaps (
    map_id, min_x, min_y, max_x, max_y, pixels_per_unit, cell_size, min_zoom, max_zoom,
    tile_size, index_ref, game_version
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertTile = db.prepare(`INSERT INTO map_tiles (
    map_id, zoom, tile_x, tile_y, asset_hash, byte_size, empty
  ) VALUES (?, ?, ?, ?, ?, ?, ?)`);

  for (const basemap of basemaps) {
    insertMap.run(
      basemap.mapId,
      basemap.minX,
      basemap.minY,
      basemap.maxX,
      basemap.maxY,
      basemap.pixelsPerUnit,
      basemap.cellSize,
      basemap.minZoom,
      basemap.maxZoom,
      basemap.tileSize,
      basemap.indexRef,
      basemap.gameVersion,
    );
    for (const tile of basemap.tiles) {
      insertTile.run(
        tile.mapId,
        tile.zoom,
        tile.tileX,
        tile.tileY,
        tile.assetHash,
        tile.byteSize,
        tile.empty ? 1 : 0,
      );
    }

    const points = db
      .query<{ id: string; map_x: number; map_y: number }, [string]>(
        `SELECT id, map_x, map_y FROM map_points WHERE map_id = ?`,
      )
      .all(basemap.mapId);
    const placements: Array<{ id: string; x: number; y: number }> = points.map((point) => ({
      id: point.id,
      x: point.map_x,
      y: point.map_y,
    }));
    const volumes = db
      .query<{ id: string; geometry_json: string }, [string]>(
        `SELECT id, geometry_json FROM map_volumes WHERE map_id = ?`,
      )
      .all(basemap.mapId);
    for (const volume of volumes) {
      const geometry = JSON.parse(volume.geometry_json) as { ring?: unknown };
      if (!Array.isArray(geometry.ring)) continue;
      for (const point of geometry.ring) {
        if (!Array.isArray(point) || point.length < 2) continue;
        placements.push({ id: volume.id, x: Number(point[0]), y: Number(point[1]) });
      }
    }
    for (const placement of placements) {
      if (
        placement.x < basemap.minX ||
        placement.x > basemap.maxX ||
        placement.y < basemap.minY ||
        placement.y > basemap.maxY
      ) {
        throw new Error(
          `map placement '${placement.id}' lies outside '${basemap.mapId}' capture bounds ` +
            `[${basemap.minX},${basemap.minY}]..[${basemap.maxX},${basemap.maxY}]`,
        );
      }
    }
  }
}
