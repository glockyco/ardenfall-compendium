export type RenderKind = "point-or-polygon" | "point" | "polygon";

export interface MapLayerConfig {
  layerId: string;
  entityType: string;
  renderKind: RenderKind;
  sourceTables: string[];
  fillColor: [number, number, number, number];
  radius: number | null;
  icon: string | null;
  tooltipFields: string[];
  filters: string[];
  legendLabel: string;
  zOrder: number;
}

export interface MapPointRow {
  id: string;
  entityId: string;
  instanceId: string;
  layerId: string;
  mapId: string | null;
  // Top-down render position; z is always 0. Elevation is metadata, not a render axis.
  position: [number, number, number];
  elevation: number;
  name: string;
  tooltip: string;
  debugOnly: boolean;
  nodeShortId: string | null;
  /** Outgoing `leads_to` destination, for portals that connect somewhere. */
  leadsTo: { label: string; shortId: string } | null;
}

export interface MapVolumeRow {
  id: string;
  layerId: string;
  entityId: string;
  instanceId: string;
  mapId: string | null;
  ring: [number, number][];
  elevationMin: number | null;
  elevationMax: number | null;
  name: string;
}

export interface MapBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface MapSummary {
  mapId: string | null;
  label: string;
  bounds: MapBounds | null;
}

export interface MapView {
  maps: MapSummary[];
  layers: MapLayerConfig[];
  points: MapPointRow[];
  volumes: MapVolumeRow[];
}
