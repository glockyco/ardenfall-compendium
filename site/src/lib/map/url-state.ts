export interface MapUiState {
  mapId: string | null;
  selected: string | null;
  hiddenLayers: string[];
  showDebug: boolean;
}

export function decodeMapState(params: URLSearchParams): MapUiState {
  const hidden = params.get("hide");
  return {
    mapId: params.get("map"),
    selected: params.get("sel"),
    hiddenLayers: hidden ? hidden.split(",").filter(Boolean) : [],
    showDebug: params.get("debug") === "1",
  };
}

export function encodeMapState(state: MapUiState): string {
  const params = new URLSearchParams();
  if (state.mapId) params.set("map", state.mapId);
  if (state.selected) params.set("sel", state.selected);
  if (state.hiddenLayers.length > 0) params.set("hide", state.hiddenLayers.join(","));
  if (state.showDebug) params.set("debug", "1");
  return params.toString();
}

export function decodeMapSearch(search: string): MapUiState {
  return decodeMapState(new URLSearchParams(search));
}
