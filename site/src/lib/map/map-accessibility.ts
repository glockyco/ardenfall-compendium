import type { MapPointRow } from "./types";

export const MAP_SEARCH_RESULT_LIMIT = 12;

export function visibleMapMarkers(
  points: MapPointRow[],
  mapId: string | null,
  hiddenLayers: string[],
  showDebug: boolean,
): MapPointRow[] {
  return points.filter(
    (point) =>
      point.mapId === mapId &&
      !hiddenLayers.includes(point.layerId) &&
      (showDebug || !point.debugOnly),
  );
}

export function mapMarkerSearchMatches(
  points: MapPointRow[],
  mapId: string | null,
  query: string,
): MapPointRow[] {
  const term = query.trim().toLowerCase();
  if (term.length === 0) return [];
  return points.filter((point) => point.mapId === mapId && point.name.toLowerCase().includes(term));
}

export function mapAccessibleName(mapLabel: string, markerCount: number): string {
  return `Map of ${mapLabel} with ${markerCount} ${markerCount === 1 ? "marker" : "markers"}`;
}

export function mapSearchEmptyState(
  query: string,
  activeMapLabel: string,
  otherMapLabels: string[],
): string {
  const matches = otherMapLabels.join(" and ");
  const otherMapMessage = matches.length > 0 ? ` Matches exist on ${matches}.` : "";
  return `No markers on ${activeMapLabel} match “${query.trim()}”.${otherMapMessage}`;
}
