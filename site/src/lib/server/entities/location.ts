import { all, get } from "../db";
import { disambiguateLabels } from "../disambiguate-labels";
import { isColorArray, isGeometry, isStringArray, parseGeneratedJson } from "../json";
import { getEntityNodeBySlug } from "./item";
import type {
  MapBounds,
  MapLayerConfig,
  MapPointRow,
  MapSummary,
  MapView,
  MapVolumeRow,
  RenderKind,
} from "../../map/types";

const KNOWN_KINDS: RenderKind[] = ["point-or-polygon", "point", "polygon"];

interface MapLayerRecord {
  layer_id: string;
  entity_id: string;
  render_kind: string;
  source_tables_json: string;
  color_json: string;
  radius: number | null;
  icon: string | null;
  tooltip_fields_json: string;
  filters_json: string;
  legend_label: string;
  z_order: number;
}

interface MapPointRecord {
  id: string;
  entity_id: string;
  instance_id: string;
  name: string;
  map_id: string | null;
  map_x: number;
  map_y: number;
  elevation: number;
  show_on_map_debug_only: number;
  short_id: string | null;
}

interface LocationVolumeRecord {
  map_min_x: number | null;
  map_min_y: number | null;
  map_max_x: number | null;
  map_max_y: number | null;
  elevation_min: number | null;
  elevation_max: number | null;
}

interface MapVolumeRecord {
  id: string;
  entity_id: string;
  instance_id: string;
  name: string;
  map_id: string | null;
  geometry_json: string;
  elevation_min: number | null;
  elevation_max: number | null;
}

interface LocationOverviewRecord {
  id: string;
  name: string;
  route_path: string;
  short_id: string;
}

interface LocationPresentationRecord {
  id: string;
  name: string;
  map_id: string | null;
  allow_fast_travel: number;
  route_path: string;
}

export interface LocationOverviewRow {
  id: string;
  name: string;
  routePath: string;
}

export interface LocationExtent {
  width: number;
  height: number;
}

export interface LocationElevation {
  min: number;
  max: number;
}

export interface LocationPresentationRow {
  id: string;
  name: string;
  routePath: string;
  mapLabel: string;
  allowFastTravel: boolean;
  extent: LocationExtent | null;
  elevation: LocationElevation | null;
}

function toFillColor(json: string, layerId: string): [number, number, number, number] {
  const parsed = parseGeneratedJson(json, "map-layer", "color_json", layerId, isColorArray);
  const [r, g, b, a = 255] = parsed;
  return [r, g, b, a] as [number, number, number, number];
}

function tableExists(name: string): boolean {
  return (
    all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", [
      name,
    ]).length > 0
  );
}

function readLayers(): MapLayerConfig[] {
  return all<MapLayerRecord>(`SELECT * FROM map_layers ORDER BY z_order, layer_id`).map((row) => {
    if (!KNOWN_KINDS.includes(row.render_kind as RenderKind)) {
      throw new Error(`unknown render kind '${row.render_kind}' for layer '${row.layer_id}'`);
    }
    const sourceTables = parseGeneratedJson(
      row.source_tables_json,
      "map-layer",
      "source_tables_json",
      row.layer_id,
      isStringArray,
    );
    for (const table of sourceTables) {
      if (table !== "map_points" && table !== "map_volumes") {
        throw new Error(
          `source table '${table}' for layer '${row.layer_id}' must be map_points or map_volumes`,
        );
      }
      if (!tableExists(table)) {
        throw new Error(`map layer '${row.layer_id}' references missing source table '${table}'`);
      }
    }
    return {
      layerId: row.layer_id,
      entityType: row.entity_id,
      renderKind: row.render_kind as RenderKind,
      sourceTables,
      fillColor: toFillColor(row.color_json, row.layer_id),
      radius: row.radius,
      icon: row.icon,
      tooltipFields: parseGeneratedJson(
        row.tooltip_fields_json,
        "map-layer",
        "tooltip_fields_json",
        row.layer_id,
        isStringArray,
      ),
      filters: parseGeneratedJson(
        row.filters_json,
        "map-layer",
        "filters_json",
        row.layer_id,
        isStringArray,
      ),
      legendLabel: row.legend_label,
      zOrder: row.z_order,
    };
  });
}

function readPoints(layer: MapLayerConfig): MapPointRow[] {
  const destinations = readLeadsToDestinations(layer.entityType);
  const rows: MapPointRow[] = [];
  for (const table of layer.sourceTables.filter((t) => t === "map_points")) {
    const records = all<MapPointRecord>(
      `SELECT p.id, p.entity_id, p.instance_id, p.name, p.map_id, p.map_x, p.map_y, p.elevation,
              p.show_on_map_debug_only, n.short_id
       FROM ${table} p
       LEFT JOIN entity_nodes n
         ON n.entity_type = p.entity_id AND n.entity_id = p.instance_id
       WHERE p.entity_id = ?
       ORDER BY p.name`,
      [layer.entityType],
    );
    for (const r of records) {
      rows.push({
        id: r.id,
        entityId: r.entity_id,
        instanceId: r.instance_id,
        layerId: layer.layerId,
        mapId: r.map_id,
        position: [r.map_x, r.map_y, 0],
        elevation: r.elevation,
        name: r.name,
        tooltip: r.name,
        debugOnly: r.show_on_map_debug_only === 1,
        nodeShortId: r.short_id,
        leadsTo: destinations.get(r.instance_id) ?? null,
      });
    }
  }
  return rows;
}

/**
 * Outgoing `leads_to` destinations keyed by source instance, loaded separately
 * rather than joined into the point query: an entity may hold several edges, and
 * joining them would multiply the map markers rather than the destinations.
 */
function readLeadsToDestinations(
  entityType: string,
): Map<string, { label: string; shortId: string }> {
  const records = all<{ source_id: string; label: string; short_id: string }>(
    `SELECT e.source_id, n.label, n.short_id
     FROM entity_edges e
     JOIN entity_nodes n
       ON n.entity_type = e.target_type AND n.entity_id = e.target_id
     WHERE e.predicate = 'leads_to' AND e.source_type = ?
     ORDER BY e.source_id, n.label`,
    [entityType],
  );
  const bySource = new Map<string, { label: string; shortId: string }>();
  for (const r of records) {
    if (!bySource.has(r.source_id)) {
      bySource.set(r.source_id, { label: r.label, shortId: r.short_id });
    }
  }
  return bySource;
}

function readVolumes(layer: MapLayerConfig): MapVolumeRow[] {
  const rows: MapVolumeRow[] = [];
  for (const table of layer.sourceTables.filter((t) => t === "map_volumes")) {
    const records = all<MapVolumeRecord>(
      `SELECT id, entity_id, instance_id, name, map_id, geometry_json, elevation_min, elevation_max
       FROM ${table} WHERE entity_id = ? ORDER BY name`,
      [layer.entityType],
    );
    for (const r of records) {
      const ring = parseGeneratedJson(
        r.geometry_json,
        "map-volume",
        "geometry_json",
        r.id,
        isGeometry,
      ).ring;
      rows.push({
        id: r.id,
        layerId: layer.layerId,
        entityId: r.entity_id,
        instanceId: r.instance_id,
        mapId: r.map_id,
        ring,
        elevationMin: r.elevation_min,
        elevationMax: r.elevation_max,
        name: r.name,
      });
    }
  }
  return rows;
}

function displayMapLabel(mapId: string | null): string {
  if (mapId === null) return "Unknown";
  return mapId.replace(/[-_]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function computeMaps(points: MapPointRow[], volumes: MapVolumeRow[]): MapSummary[] {
  const byMap = new Map<string | null, { bounds: MapBounds | null; contentCount: number }>();
  const addContent = (mapId: string | null): void => {
    const previous = byMap.get(mapId);
    byMap.set(mapId, {
      bounds: previous?.bounds ?? null,
      contentCount: (previous?.contentCount ?? 0) + 1,
    });
  };
  const extend = (mapId: string | null, x: number, y: number): void => {
    const previous = byMap.get(mapId);
    const bounds = previous?.bounds ?? null;
    const next: MapBounds = bounds
      ? {
          minX: Math.min(bounds.minX, x),
          minY: Math.min(bounds.minY, y),
          maxX: Math.max(bounds.maxX, x),
          maxY: Math.max(bounds.maxY, y),
        }
      : { minX: x, minY: y, maxX: x, maxY: y };
    byMap.set(mapId, { bounds: next, contentCount: previous?.contentCount ?? 0 });
  };
  for (const p of points) {
    addContent(p.mapId);
    extend(p.mapId, p.position[0], p.position[1]);
  }
  for (const v of volumes) {
    addContent(v.mapId);
    for (const [x, y] of v.ring) extend(v.mapId, x, y);
  }
  return [...byMap.entries()]
    .sort((a, b) => {
      if (a[1].contentCount !== b[1].contentCount) {
        return b[1].contentCount - a[1].contentCount;
      }
      if (a[0] === b[0]) return 0;
      if (a[0] === null) return 1;
      if (b[0] === null) return -1;
      return a[0].localeCompare(b[0]);
    })
    .map(([mapId, aggregate]) => ({
      mapId,
      label: displayMapLabel(mapId),
      bounds: aggregate.bounds,
    }));
}

export const listLocations = (): LocationOverviewRow[] =>
  disambiguateLabels(
    all<LocationOverviewRecord>(
      `SELECT l.id, l.name, n.route_path, n.short_id
       FROM locations l
       JOIN entity_nodes n
         ON n.entity_type = 'location'
        AND n.entity_id = l.id
        AND n.has_page = 1
       WHERE l.enabled = 1
       ORDER BY l.name, l.id`,
    ).map((row) => ({
      id: row.id,
      name: row.name,
      routePath: row.route_path,
      shortId: row.short_id,
    })),
    "name",
    (row) => row.shortId,
  ).map(({ shortId: _shortId, ...row }) => row);

export const getLocationPresentation = (slug: string): LocationPresentationRow | undefined => {
  const node = getEntityNodeBySlug("location", slug);
  if (!node || !node.hasPage) return undefined;
  const row = get<LocationPresentationRecord>(
    `SELECT l.id, l.name, l.map_id, l.allow_fast_travel, n.route_path
     FROM locations l
     JOIN entity_nodes n
       ON n.entity_type = 'location'
      AND n.entity_id = l.id
      AND n.has_page = 1
     WHERE l.id = ? AND l.enabled = 1`,
    [node.entityId],
  );
  if (!row) return undefined;

  const volumes = all<LocationVolumeRecord>(
    `SELECT map_min_x, map_min_y, map_max_x, map_max_y, elevation_min, elevation_max
     FROM location_volumes
     WHERE location_id = ?
     ORDER BY volume_index`,
    [row.id],
  );
  let minX: number | null = null;
  let minY: number | null = null;
  let maxX: number | null = null;
  let maxY: number | null = null;
  let elevationMin: number | null = null;
  let elevationMax: number | null = null;
  for (const volume of volumes) {
    if (
      volume.map_min_x !== null &&
      volume.map_min_y !== null &&
      volume.map_max_x !== null &&
      volume.map_max_y !== null
    ) {
      minX = minX === null ? volume.map_min_x : Math.min(minX, volume.map_min_x);
      minY = minY === null ? volume.map_min_y : Math.min(minY, volume.map_min_y);
      maxX = maxX === null ? volume.map_max_x : Math.max(maxX, volume.map_max_x);
      maxY = maxY === null ? volume.map_max_y : Math.max(maxY, volume.map_max_y);
    }
    if (volume.elevation_min !== null && volume.elevation_max !== null) {
      elevationMin =
        elevationMin === null ? volume.elevation_min : Math.min(elevationMin, volume.elevation_min);
      elevationMax =
        elevationMax === null ? volume.elevation_max : Math.max(elevationMax, volume.elevation_max);
    }
  }

  return {
    id: row.id,
    name: row.name,
    routePath: row.route_path,
    mapLabel: displayMapLabel(row.map_id),
    allowFastTravel: row.allow_fast_travel === 1,
    extent:
      minX === null || minY === null || maxX === null || maxY === null
        ? null
        : { width: maxX - minX, height: maxY - minY },
    elevation:
      elevationMin === null || elevationMax === null
        ? null
        : { min: elevationMin, max: elevationMax },
  };
};

export function getMapView(): MapView {
  const layers = readLayers();
  const points = layers.flatMap(readPoints);
  const volumes = layers.flatMap(readVolumes);
  return { maps: computeMaps(points, volumes), layers, points, volumes };
}
