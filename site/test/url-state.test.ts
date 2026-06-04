import { describe, expect, it } from "bun:test";
import { decodeMapState, encodeMapState, type MapUiState } from "../src/lib/map/url-state";

const full: MapUiState = {
  mapId: "ardenfall",
  center: [12.5, -8.25],
  zoom: 3,
  selected: "abc12345",
  hiddenLayers: ["locations"],
  showDebug: true,
  fastTravelOnly: false,
};

describe("map url-state", () => {
  it("round-trips full state through query params", () => {
    const qs = encodeMapState(full);
    const decoded = decodeMapState(new URLSearchParams(qs));
    expect(decoded).toEqual(full);
  });

  it("returns defaults for an empty query", () => {
    expect(decodeMapState(new URLSearchParams(""))).toEqual({
      mapId: null,
      center: null,
      zoom: null,
      selected: null,
      hiddenLayers: [],
      showDebug: false,
      fastTravelOnly: false,
    });
  });

  it("omits absent keys from the encoded string", () => {
    const qs = encodeMapState({
      mapId: null,
      center: null,
      zoom: null,
      selected: "abc12345",
      hiddenLayers: [],
      showDebug: false,
      fastTravelOnly: false,
    });
    const params = new URLSearchParams(qs);
    expect(params.get("sel")).toBe("abc12345");
    expect(params.has("map")).toBe(false);
    expect(params.has("c")).toBe(false);
    expect(params.has("debug")).toBe(false);
  });

  it("ignores malformed center/zoom without throwing", () => {
    const decoded = decodeMapState(new URLSearchParams("c=bad&z=NaN"));
    expect(decoded.center).toBeNull();
    expect(decoded.zoom).toBeNull();
  });
});
