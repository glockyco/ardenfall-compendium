import type { Database } from "bun:sqlite";
import { deriveEntityNodeSlug, prepareEntityNodeWriter } from "../../relationships/entity-nodes.ts";
import type { PipelineDiagnostic } from "../../relationships/relationship-graph.ts";

interface SceneDialogueRow {
  id: string;
  dialogue_id: string;
  graph_name: string;
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
 * Publishes where a scene lets a reader start a conversation.
 *
 * The prose belongs to the conversation, which every holder shares, so this publishes the places
 * and links them to it. A placement the game leaves nameless is identified by its cell, because the
 * game gives the reader no name and inventing one would state something the data does not.
 *
 * Must run after the map read models, which create the graph tables, and after the dialogue read
 * models, whose nodes this links to.
 */
export function emitSceneDialogueReadModels(
  db: Database,
  routeBase = "/scene-dialogue",
): PipelineDiagnostic[] {
  const diagnostics: PipelineDiagnostic[] = [];
  const rows = db
    .query<SceneDialogueRow, []>(
      `SELECT id, dialogue_id, graph_name FROM scene_dialogue ORDER BY id`,
    )
    .all();

  const writeNode = prepareEntityNodeWriter(db);
  const presentationInsert = db.prepare(
    `INSERT INTO scene_dialogue_presentation_rows (
      id, render_context, dialogue_id, dialogue_label, dialogue_route_path, graph_name,
      placement_count, placements_json
    ) VALUES (?, 'scene-dialogue-presentation-v1', ?, ?, ?, ?, ?, ?)`,
  );
  const edgeInsert = db.prepare(
    `INSERT OR IGNORE INTO entity_edges (
      edge_id, source_type, source_id, target_type, target_id, predicate, label, weight,
      evidence_json, anchor
    ) VALUES (?, 'scene-dialogue', ?, 'dialogue', ?, 'starts_dialogue', ?, 1, ?, NULL)`,
  );
  const placementQuery = db.query<PlacementRow, [string]>(
    `SELECT p.id, p.cell, p.map_id, p.speaker_name, p.interaction_text,
            m.map_x, m.map_y, m.elevation
     FROM scene_dialogue_placements p
     LEFT JOIN placements m
       ON m.entity_id = 'scene-dialogue' AND m.instance_id = p.id
     WHERE p.scene_dialogue_id = ?
     ORDER BY p.placement_ordinal`,
  );
  const dialogueQuery = db.query<{ label: string; route_path: string; has_page: number }, [string]>(
    `SELECT display_label AS label, route_path, has_page FROM entity_nodes
     WHERE entity_type = 'dialogue' AND entity_id = ?`,
  );

  const tx = db.transaction(() => {
    for (const row of rows) {
      const placements = placementQuery.all(row.id);
      const conversation = dialogueQuery.get(row.dialogue_id) ?? undefined;
      const label = sceneLabel(row, placements, conversation?.label);
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

      presentationInsert.run(
        row.id,
        row.dialogue_id,
        conversation?.label ?? row.graph_name,
        conversation != null && conversation.has_page === 1 ? conversation.route_path : null,
        row.graph_name,
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

      if (conversation === undefined || conversation === null) {
        diagnostics.push({
          severity: "diagnostic",
          source: "relationship-graph",
          code: "sceneDialogueConversationUnresolved",
          message: `Scene dialogue '${row.id}' starts conversation '${row.dialogue_id}', which the snapshot does not carry.`,
          entityType: "scene-dialogue",
          entityId: row.id,
          field: "dialogue_id",
        });
        continue;
      }

      edgeInsert.run(
        `scene-dialogue:${row.id}:starts_dialogue:${row.dialogue_id}`,
        row.id,
        row.dialogue_id,
        conversation.label,
        JSON.stringify({ placements: placements.length }),
      );
    }
  });
  tx();

  return diagnostics;
}

/** The speaker name every placement agrees on, or the conversation's own name. */
function sceneLabel(
  row: SceneDialogueRow,
  placements: PlacementRow[],
  conversationLabel: string | undefined,
): string {
  const names = new Set(
    placements
      .map((placement) => placement.speaker_name)
      .filter((name): name is string => name !== null && name.trim().length > 0),
  );
  const [only] = [...names];
  if (names.size === 1 && only !== undefined) return only;
  return conversationLabel ?? row.graph_name;
}
