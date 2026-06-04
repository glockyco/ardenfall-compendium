export interface MapUiState {
  mapId: string | null;
  center: [number, number] | null;
  zoom: number | null;
  selected: string | null;
  hiddenLayers: string[];
  showDebug: boolean;
  fastTravelOnly: boolean;
}

const num = (value: string | null): number | null => {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function decodeMapState(params: URLSearchParams): MapUiState {
  const center = params.get("c");
  let parsedCenter: [number, number] | null = null;
  if (center) {
    const [x, y] = center.split(",").map((value) => Number(value));
    if (Number.isFinite(x) && Number.isFinite(y)) parsedCenter = [x, y];
  }
  const hidden = params.get("hide");
  return {
    mapId: params.get("map"),
    center: parsedCenter,
    zoom: num(params.get("z")),
    selected: params.get("sel"),
    hiddenLayers: hidden ? hidden.split(",").filter(Boolean) : [],
    showDebug: params.get("debug") === "1",
    fastTravelOnly: params.get("ft") === "1",
  };
}

export function encodeMapState(state: MapUiState): string {
  const params = new URLSearchParams();
  if (state.mapId) params.set("map", state.mapId);
  if (state.center) params.set("c", `${state.center[0]},${state.center[1]}`);
  if (state.zoom !== null) params.set("z", String(state.zoom));
  if (state.selected) params.set("sel", state.selected);
  if (state.hiddenLayers.length > 0) params.set("hide", state.hiddenLayers.join(","));
  if (state.showDebug) params.set("debug", "1");
  if (state.fastTravelOnly) params.set("ft", "1");
  return params.toString();
}
