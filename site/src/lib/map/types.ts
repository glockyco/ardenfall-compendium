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
  layerId: string;
  mapId: string | null;
  position: [number, number, number];
  name: string;
  tooltip: string;
  debugOnly: boolean;
  fastTravel: boolean;
  nodeShortId: string | null;
}

export interface MapVolumeRow {
  id: string;
  layerId: string;
  locationId: string;
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
