import { all, get } from "../db";
import type { DialogueLine } from "./dialogue";
import { isRichTextDocument, parseGeneratedJson, validateRenderContext } from "../json";
import { getMapHref } from "../map-href";
import { getEntityNodeBySlug } from "./item";

interface SceneDialogueOverviewRecord {
  id: string;
  name: string;
  route_path: string;
  graph_name: string;
  line_count: number;
  placement_count: number;
}

interface SceneDialoguePresentationRecord extends SceneDialogueOverviewRecord {
  render_context: string;
  lines_json: string;
  placements_json: string;
}

export interface SceneDialogueOverviewRow {
  id: string;
  name: string;
  routePath: string;
  /** The graph asset's name. An internal identifier, shown only when no speaker name exists. */
  graphName: string;
  lineCount: number;
  placementCount: number;
}

/** One place a reader can start this dialogue. */
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
  lines: DialogueLine[];
  placements: SceneDialoguePlacement[];
  /** Selects this dialogue on the map, which shows every placement that starts it. */
  mapHref: string | null;
}

const isDialogueLineArray = (value: unknown): value is DialogueLine[] =>
  Array.isArray(value) &&
  value.every(
    (line) =>
      typeof line === "object" &&
      line !== null &&
      "kind" in line &&
      (line.kind === "greeting" || line.kind === "topic") &&
      "text" in line &&
      isRichTextDocument(line.text),
  );

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

const OVERVIEW_COLUMNS = `d.id, n.display_label AS name, n.route_path, d.graph_name,
   d.line_count, d.placement_count`;

const toOverviewRow = (row: SceneDialogueOverviewRecord): SceneDialogueOverviewRow => ({
  id: row.id,
  name: row.name,
  routePath: row.route_path,
  graphName: row.graph_name,
  lineCount: row.line_count,
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
    `SELECT ${OVERVIEW_COLUMNS}, d.render_context, d.lines_json, d.placements_json
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
    lines: parseGeneratedJson(
      row.lines_json,
      "scene-dialogue",
      "lines_json",
      row.id,
      isDialogueLineArray,
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
