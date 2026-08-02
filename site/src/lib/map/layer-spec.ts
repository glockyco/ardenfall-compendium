import type { MapLayerConfig, MapPointRow, MapVolumeRow, RenderKind } from "./types";

export interface MapUiFilters {
  hiddenLayers: string[];
  showDebug: boolean;
  selected?: string | null;
}

export type LayerSpecKind = "scatterplot" | "polygon";

export interface LayerSpec {
  id: string;
  layerId: string;
  kind: LayerSpecKind;
  data: MapPointRow[] | MapVolumeRow[];
  visible: boolean;
  fillColor: [number, number, number, number];
  radius?: number;
  selectedNodeShortId?: string | null;
  pickable: boolean;
}

const KIND_PARTS: Record<RenderKind, LayerSpecKind[]> = {
  "point-or-polygon": ["polygon", "scatterplot"],
  point: ["scatterplot"],
  polygon: ["polygon"],
};

function filterPoints(rows: MapPointRow[], ui: MapUiFilters): MapPointRow[] {
  return rows.filter((r) => ui.showDebug || !r.debugOnly);
}

export function buildEntityLayerSpecs(
  layer: MapLayerConfig,
  points: MapPointRow[],
  volumes: MapVolumeRow[],
  ui: MapUiFilters,
): LayerSpec[] {
  const parts = KIND_PARTS[layer.renderKind];
  if (!parts) {
    throw new Error(`unknown render kind '${layer.renderKind}' for layer '${layer.layerId}'`);
  }
  const visible = !ui.hiddenLayers.includes(layer.layerId);
  const layerPoints = points.filter((p) => p.layerId === layer.layerId);
  const layerVolumes = volumes.filter((v) => v.layerId === layer.layerId);

  const specs: LayerSpec[] = [];
  for (const kind of parts) {
    if (kind === "polygon") {
      specs.push({
        id: `${layer.layerId}::polygon`,
        layerId: layer.layerId,
        kind,
        data: layerVolumes,
        visible,
        fillColor: layer.fillColor,
        pickable: true,
      });
    } else {
      specs.push({
        id: `${layer.layerId}::point`,
        layerId: layer.layerId,
        kind,
        data: filterPoints(layerPoints, ui),
        visible,
        fillColor: layer.fillColor,
        radius: layer.radius ?? 6,
        selectedNodeShortId: ui.selected ?? null,
        pickable: true,
      });
    }
  }
  return specs;
}
