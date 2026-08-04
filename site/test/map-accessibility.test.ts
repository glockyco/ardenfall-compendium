import { describe, expect, it } from "bun:test";
import type { MapPointRow } from "../src/lib/map/types";
import {
  mapAccessibleName,
  mapMarkerSearchMatches,
  mapSearchEmptyState,
  visibleMapMarkers,
} from "../src/lib/map/map-accessibility";

const point = (id: string, overrides: Partial<MapPointRow> = {}): MapPointRow => ({
  id,
  entityId: "location",
  instanceId: id,
  layerId: "locations",
  mapId: "overworld",
  position: [0, 0, 0],
  elevation: 0,
  name: id,
  tooltip: id,
  debugOnly: false,
  nodeShortId: id,
  routePath: `/locations/${id}`,
  hasPage: true,
  leadsTo: null,
  ...overrides,
});

describe("map accessibility helpers", () => {
  it("keeps the marker list aligned with the active map and visible layers", () => {
    // Named rather than indexed, so an assertion says which marker it expects.
    const visible = point("overworld-visible");
    const hidden = point("overworld-hidden", { layerId: "portals" });
    const debugOnly = point("overworld-debug", { debugOnly: true });
    const interior = point("interior-visible", { mapId: "interior" });
    const markers = [visible, hidden, debugOnly, interior];

    expect(visibleMapMarkers(markers, "overworld", ["portals"], false)).toEqual([visible]);
    expect(visibleMapMarkers(markers, "overworld", [], true)).toEqual([visible, hidden, debugOnly]);
  });

  it("reports result truncation and map-specific empty states", () => {
    const markers = [
      point("Akaga", { name: "Akaga" }),
      point("Akagi", { name: "Akagi" }),
      point("interior-akaga", { mapId: "interior", name: "Akaga interior" }),
    ];

    expect(mapMarkerSearchMatches(markers, "overworld", "aka")).toHaveLength(2);
    expect(mapMarkerSearchMatches(markers, "overworld", "missing")).toHaveLength(0);
    expect(mapSearchEmptyState("missing", "Overworld", [])).toBe(
      "No markers on Overworld match “missing”.",
    );
    expect(mapSearchEmptyState("akaga", "Overworld", ["Interior"])).toBe(
      "No markers on Overworld match “akaga”. Matches exist on Interior.",
    );
  });

  it("names the active map and visible marker count", () => {
    expect(mapAccessibleName("Overworld", 249)).toBe("Map of Overworld with 249 markers");
  });
});
