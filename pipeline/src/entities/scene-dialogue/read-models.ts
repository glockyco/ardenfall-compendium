import type { Database } from "bun:sqlite";
import { deriveEntityNodeSlug, prepareEntityNodeWriter } from "../../relationships/entity-nodes.ts";
import type { PipelineDiagnostic } from "../../relationships/relationship-graph.ts";
import { translateRichTextV1 } from "../../rich-text/rich-text-v1.ts";
import type { SceneDialogueLineSnapshot } from "../../types.ts";

interface SceneDialogueRow {
  id: string;
  graph_name: string;
  lines_json: string;
}

interface PlacementRow {
  id: string;
  cell: string;
  map_id: string | null;
  speaker_name: string | null;
  interaction_text: string | null;
  map_x: number | null;
  map_y: number | null;
  elevation: number | null;
}

/**
 * Publishes the dialogue a scene places.
 *
 * Lines reach the page as rich text through the same translation quest dialogue uses, so one
 * contract renders every authored line. The authored order and the authored branches survive: this
 * evaluates no condition and chooses no branch.
 *
 * A page is titled by the speaker the placements name, because a graph asset name is an internal
 * identifier. Placements that disagree on the name, or carry none, leave the graph name showing
 * rather than picking one placement's name as the truth.
 *
 * Must run after the map read models, which create the graph tables.
 */
export function emitSceneDialogueReadModels(
  db: Database,
  routeBase = "/scene-dialogue",
): PipelineDiagnostic[] {
  const diagnostics: PipelineDiagnostic[] = [];
  const rows = db
    .query<SceneDialogueRow, []>(
      `SELECT id, graph_name, lines_json FROM scene_dialogue ORDER BY id`,
    )
    .all();

  const writeNode = prepareEntityNodeWriter(db);
  const presentationInsert = db.prepare(
    `INSERT INTO scene_dialogue_presentation_rows (
      id, render_context, graph_name, line_count, lines_json, placement_count, placements_json
    ) VALUES (?, 'scene-dialogue-presentation-v1', ?, ?, ?, ?, ?)`,
  );
  const placementQuery = db.query<PlacementRow, [string]>(
    `SELECT p.id, p.cell, p.map_id, p.speaker_name, p.interaction_text,
            m.map_x, m.map_y, m.elevation
     FROM scene_dialogue_placements p
     LEFT JOIN placements m
       ON m.entity_id = 'scene-dialogue' AND m.instance_id = p.id
     WHERE p.dialogue_id = ?
     ORDER BY p.placement_ordinal`,
  );

  const tx = db.transaction(() => {
    for (const row of rows) {
      const placements = placementQuery.all(row.id);
      const label = dialogueLabel(row, placements);
      const slug = deriveEntityNodeSlug(label, row.id);
      writeNode({
        entityType: "scene-dialogue",
        entityId: row.id,
        label,
        routePath: `${routeBase}/${slug.canonicalSlug}`,
        canonicalSlug: slug.canonicalSlug,
        shortId: slug.shortId,
        hasPage: true,
      });

      const rendered = parseLines(row).map((line) => {
        const text = translateRichTextV1(line.text);
        for (const diagnostic of text.diagnostics) {
          diagnostics.push({
            severity: diagnostic.severity,
            source: "rich-text",
            code: diagnostic.code,
            message: diagnostic.message,
            entityType: "scene-dialogue",
            entityId: row.id,
            field: diagnostic.field,
          });
        }
        return { kind: line.kind, text };
      });

      presentationInsert.run(
        row.id,
        row.graph_name,
        rendered.length,
        JSON.stringify(rendered),
        placements.length,
        JSON.stringify(
          placements.map((placement) => ({
            id: placement.id,
            cell: placement.cell,
            mapId: placement.map_id,
            speakerName: placement.speaker_name,
            interactionText: placement.interaction_text,
            mapX: placement.map_x,
            mapY: placement.map_y,
            elevation: placement.elevation,
          })),
        ),
      );

      if (rendered.length === 0) {
        diagnostics.push({
          severity: "diagnostic",
          source: "scene-dialogue",
          code: "sceneDialogueEmpty",
          message: `Dialogue graph '${row.graph_name}' publishes no authored greeting or topic.`,
          entityType: "scene-dialogue",
          entityId: row.id,
          field: "lines",
        });
      }
    }
  });
  tx();

  return diagnostics;
}

/**
 * The speaker name every placement agrees on, or the graph name when they do not agree.
 */
function dialogueLabel(row: SceneDialogueRow, placements: PlacementRow[]): string {
  const names = new Set(
    placements
      .map((placement) => placement.speaker_name)
      .filter((name): name is string => name !== null && name.trim().length > 0),
  );
  const [only] = [...names];
  return names.size === 1 && only !== undefined ? only : row.graph_name;
}

function parseLines(row: SceneDialogueRow): SceneDialogueLineSnapshot[] {
  const parsed: unknown = JSON.parse(row.lines_json);
  if (!Array.isArray(parsed)) {
    throw new Error(`scene dialogue '${row.id}' has a non-array lines_json`);
  }
  return parsed.map((line) => {
    if (
      typeof line !== "object" ||
      line === null ||
      !("kind" in line) ||
      typeof line.kind !== "string" ||
      !("text" in line) ||
      typeof line.text !== "string"
    ) {
      throw new Error(`scene dialogue '${row.id}' has a line without a kind and text`);
    }
    return line as SceneDialogueLineSnapshot;
  });
}
