import { describe, expect, it } from "bun:test";
import { decodeMapState, encodeMapState, type MapUiState } from "../src/lib/map/url-state";

const full: MapUiState = {
  mapId: "ardenfall",
  selected: "abc12345",
  hiddenLayers: ["locations"],
  showDebug: true,
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
      selected: null,
      hiddenLayers: [],
      showDebug: false,
    });
  });

  it("omits absent keys from the encoded string", () => {
    const qs = encodeMapState({
      mapId: null,
      selected: "abc12345",
      hiddenLayers: [],
      showDebug: false,
    });
    const params = new URLSearchParams(qs);
    expect(params.get("sel")).toBe("abc12345");
    expect(params.has("map")).toBe(false);
    expect(params.has("hide")).toBe(false);
    expect(params.has("debug")).toBe(false);
  });

  it("encodes multiple hidden layers as a comma list", () => {
    const qs = encodeMapState({
      mapId: null,
      selected: null,
      hiddenLayers: ["locations", "vendors"],
      showDebug: false,
    });
    const params = new URLSearchParams(qs);
    expect(params.get("hide")).toBe("locations,vendors");
    expect(params.has("ft")).toBe(false);
  });
});
