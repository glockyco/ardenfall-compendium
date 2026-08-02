import type { MapPointRow, MapView } from "./types";
import { decodeMapSearch, type MapUiState } from "./url-state";

export class MapStore {
  readonly view: MapView;
  ui = $state<MapUiState>({
    mapId: null,
    selected: null,
    hiddenLayers: [],
    showDebug: false,
  });

  constructor(view: MapView) {
    this.view = view;
    this.ui.mapId = this.defaultMapId();
  }

  private defaultMapId(): string | null {
    return this.view.maps.find((m) => m.mapId !== null)?.mapId ?? this.view.maps[0]?.mapId ?? null;
  }

  /** Apply URL-encoded state on the client; the prerendered shell uses defaults. */
  hydrateFromSearch(search: string): void {
    this.ui = { ...this.ui, ...decodeMapSearch(search) };
    if (this.ui.mapId === null) this.ui.mapId = this.defaultMapId();
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

  /**
   * Select a point and switch to the map it sits on. Portal connections cross
   * maps, so following one has to move the view as well as the selection.
   */
  goToPoint(shortId: string): void {
    const point = this.view.points.find((p) => p.nodeShortId === shortId);
    if (point?.mapId) this.ui.mapId = point.mapId;
    this.ui.selected = shortId;
  }
}
