import type { MapPointRow, MapView } from "./types";
import type { MapUiState } from "./url-state";

export class MapStore {
  readonly view: MapView;
  ui = $state<MapUiState>({
    mapId: null,
    center: null,
    zoom: null,
    selected: null,
    hiddenLayers: [],
    showDebug: false,
    fastTravelOnly: false,
  });

  constructor(view: MapView, initial: Partial<MapUiState>) {
    this.view = view;
    this.ui = { ...this.ui, ...initial };
    if (this.ui.mapId === null) this.ui.mapId = view.maps[0]?.mapId ?? null;
  }

  get activeMapId(): string | null {
    return this.ui.mapId;
  }

  get selectedPoint(): MapPointRow | null {
    if (!this.ui.selected) return null;
    return this.view.points.find((p) => p.nodeShortId === this.ui.selected) ?? null;
  }

  toggleLayer(layerId: string): void {
    this.ui.hiddenLayers = this.ui.hiddenLayers.includes(layerId)
      ? this.ui.hiddenLayers.filter((id) => id !== layerId)
      : [...this.ui.hiddenLayers, layerId];
  }

  select(shortId: string | null): void {
    this.ui.selected = shortId;
  }
}
