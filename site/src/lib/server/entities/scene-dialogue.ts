import { all, get } from "../db";
import { parseGeneratedJson, validateRenderContext } from "../json";
import { getMapHref } from "../map-href";
import { getEntityNodeBySlug } from "./item";

interface SceneDialogueOverviewRecord {
  id: string;
  name: string;
  route_path: string;
  dialogue_id: string;
  dialogue_label: string;
  dialogue_route_path: string | null;
  graph_name: string;
  placement_count: number;
}

interface SceneDialoguePresentationRecord extends SceneDialogueOverviewRecord {
  render_context: string;
  placements_json: string;
}

export interface SceneDialogueOverviewRow {
  id: string;
  name: string;
  routePath: string;
  /** The conversation these placements start. */
  dialogueId: string;
  dialogueLabel: string;
  dialogueRoutePath: string | null;
  graphName: string;
  placementCount: number;
}

/** One place a reader can start the conversation. */
export interface SceneDialoguePlacement {
  id: string;
  cell: string;
  mapId: string | null;
  /** Null when the game gives this speaker no name. */
  speakerName: string | null;
  interactionText: string | null;
  mapX: number | null;
  mapY: number | null;
  elevation: number | null;
}

export interface SceneDialoguePresentationRow extends SceneDialogueOverviewRow {
  renderContext: "scene-dialogue-presentation-v1";
  placements: SceneDialoguePlacement[];
  mapHref: string | null;
}

const isPlacementArray = (value: unknown): value is SceneDialoguePlacement[] =>
  Array.isArray(value) &&
  value.every(
    (placement) =>
      typeof placement === "object" &&
      placement !== null &&
      "id" in placement &&
      typeof placement.id === "string" &&
      "cell" in placement &&
      typeof placement.cell === "string",
  );

const OVERVIEW_COLUMNS = `d.id, n.display_label AS name, n.route_path, d.dialogue_id,
   d.dialogue_label, d.dialogue_route_path, d.graph_name, d.placement_count`;

const toOverviewRow = (row: SceneDialogueOverviewRecord): SceneDialogueOverviewRow => ({
  id: row.id,
  name: row.name,
  routePath: row.route_path,
  dialogueId: row.dialogue_id,
  dialogueLabel: row.dialogue_label,
  dialogueRoutePath: row.dialogue_route_path,
  graphName: row.graph_name,
  placementCount: row.placement_count,
});

export const listSceneDialogue = (): SceneDialogueOverviewRow[] =>
  all<SceneDialogueOverviewRecord>(
    `SELECT ${OVERVIEW_COLUMNS}
     FROM scene_dialogue_presentation_rows d
     JOIN entity_nodes n
       ON n.entity_type = 'scene-dialogue'
      AND n.entity_id = d.id
     ORDER BY n.display_label, d.id`,
  ).map(toOverviewRow);

export const getSceneDialoguePresentation = (
  slug: string,
): SceneDialoguePresentationRow | undefined => {
  const node = getEntityNodeBySlug("scene-dialogue", slug);
  if (!node) return undefined;
  const row = get<SceneDialoguePresentationRecord>(
    `SELECT ${OVERVIEW_COLUMNS}, d.render_context, d.placements_json
     FROM scene_dialogue_presentation_rows d
     JOIN entity_nodes n
       ON n.entity_type = 'scene-dialogue'
      AND n.entity_id = d.id
     WHERE d.id = ?`,
    [node.entityId],
  );
  if (!row) return undefined;
  return {
    ...toOverviewRow(row),
    renderContext: validateRenderContext(
      row.render_context,
      "scene-dialogue",
      row.id,
      "scene-dialogue-presentation-v1",
    ),
    placements: parseGeneratedJson(
      row.placements_json,
      "scene-dialogue",
      "placements_json",
      row.id,
      isPlacementArray,
    ),
    mapHref: getMapHref("scene-dialogue", row.id),
  };
};
