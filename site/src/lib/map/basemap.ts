import type { MapBasemap, MapBasemapTile } from "./types";

/** Indexes the generated contract so each selected tile position performs one lookup. */
export function basemapTileIndex(basemap: MapBasemap): ReadonlyMap<string, MapBasemapTile> {
  return new Map(basemap.tiles.map((tile) => [`${tile.zoom}/${tile.x}/${tile.y}`, tile] as const));
}

/**
 * deck.gl's tileSize is the world span at zoom zero in an orthographic view. The capture's tileSize
 * is image pixels, so it is not the same number unless pixels and world units happen to match.
 */
export function deckTileSize(basemap: MapBasemap): number {
  return basemap.cellSize * 2 ** basemap.maxZoom;
}

export interface BasemapView {
  target: [number, number, number];
  zoom: number;
  width: number;
  height: number;
}

export interface VisibleBasemapTile {
  tile: MapBasemapTile;
  bounds: [number, number, number, number];
}

/** Selects only visible tiles and falls back to the nearest rendered parent for empty positions. */
export function visibleBasemapTiles(basemap: MapBasemap, view: BasemapView): VisibleBasemapTile[] {
  const index = basemapTileIndex(basemap);
  const zoom = Math.max(basemap.minZoom, Math.min(basemap.maxZoom, Math.floor(view.zoom)));
  const scale = 2 ** view.zoom;
  const viewBounds = {
    minX: Math.max(basemap.bounds.minX, view.target[0] - view.width / (2 * scale)),
    minY: Math.max(basemap.bounds.minY, view.target[1] - view.height / (2 * scale)),
    maxX: Math.min(basemap.bounds.maxX, view.target[0] + view.width / (2 * scale)),
    maxY: Math.min(basemap.bounds.maxY, view.target[1] + view.height / (2 * scale)),
  };
  if (viewBounds.minX > viewBounds.maxX || viewBounds.minY > viewBounds.maxY) return [];

  const span = basemap.cellSize * 2 ** (basemap.maxZoom - zoom);
  const minTileX = Math.floor(viewBounds.minX / span);
  const minTileY = Math.floor(viewBounds.minY / span);
  const maxTileX = Math.floor((viewBounds.maxX - Number.EPSILON) / span);
  const maxTileY = Math.floor((viewBounds.maxY - Number.EPSILON) / span);
  const selected = new Map<string, VisibleBasemapTile>();

  for (let y = minTileY; y <= maxTileY; y++) {
    for (let x = minTileX; x <= maxTileX; x++) {
      let candidateZoom = zoom;
      let candidateX = x;
      let candidateY = y;
      while (candidateZoom >= basemap.minZoom) {
        const tile = index.get(`${candidateZoom}/${candidateX}/${candidateY}`);
        if (tile && !tile.empty && tile.assetUrl !== null) {
          const candidateSpan = basemap.cellSize * 2 ** (basemap.maxZoom - candidateZoom);
          const key = `${candidateZoom}/${candidateX}/${candidateY}`;
          selected.set(key, {
            tile,
            bounds: [
              candidateX * candidateSpan,
              candidateY * candidateSpan,
              (candidateX + 1) * candidateSpan,
              (candidateY + 1) * candidateSpan,
            ],
          });
          break;
        }
        candidateZoom--;
        candidateX = Math.floor(candidateX / 2);
        candidateY = Math.floor(candidateY / 2);
      }
    }
  }
  return [...selected.values()];
}

/** deck.gl paints later layers over earlier ones, so imagery always precedes markers. */
export function composeMapLayers<T>(basemap: readonly T[], markers: readonly T[]): T[] {
  return [...basemap, ...markers];
}
