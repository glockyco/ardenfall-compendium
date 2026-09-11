import type { Database } from "bun:sqlite";
import type {
  SceneDialogueFieldName,
  SceneDialogueSnapshotFields,
} from "../../../dist/entity-fields.mjs";
import type { SceneDialoguePlacementSnapshot, SnapshotEnvelope } from "../../types.ts";
import { entityRows } from "../../types.ts";
import { sourceToMapPoint } from "../location/canonicaliser.ts";

export function sceneDialogueField<
  K extends SceneDialogueFieldName & keyof SceneDialogueSnapshotFields,
>(fields: SceneDialogueSnapshotFields, key: K): SceneDialogueSnapshotFields[K] {
  return fields[key];
}

/**
 * Writes one row per placed conversation, and one row per placement.
 *
 * The walk writes a row per batch of cells, so a graph placed in two batches arrives as two rows
 * with the same id. They are merged here rather than in the walk, which keeps the walk stateless
 * across batches.
 */
export function canonicaliseSceneDialogue(db: Database, envelope: SnapshotEnvelope): void {
  const sceneInsert = db.prepare(
    `INSERT INTO scene_dialogue (id, dialogue_id, graph_name, placements_json)
     VALUES (?, ?, ?, ?)`,
  );
  const placementInsert = db.prepare(
    `INSERT INTO scene_dialogue_placements (
      id, scene_dialogue_id, placement_ordinal, cell, map_id, speaker_name, interaction_text,
      source_position_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const mapPlacementInsert = db.prepare(
    `INSERT INTO placements (
      entity_id, instance_id, map_id, map_x, map_y, elevation, source_ref_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  const merged = new Map<
    string,
    { dialogueId: string; graphName: string; placements: SceneDialoguePlacementSnapshot[] }
  >();

  for (const row of entityRows<SceneDialogueSnapshotFields>(envelope)) {
    const fields = row.fields;
    const existing = merged.get(row.id);
    if (existing === undefined) {
      merged.set(row.id, {
        dialogueId: sceneDialogueField(fields, "dialogueId"),
        graphName: sceneDialogueField(fields, "graphName"),
        placements: [...(sceneDialogueField(fields, "placements") ?? [])],
      });
      continue;
    }

    existing.placements.push(...(sceneDialogueField(fields, "placements") ?? []));
  }

  const tx = db.transaction(() => {
    for (const id of [...merged.keys()].sort(compareIds)) {
      const scene = merged.get(id)!;
      scene.placements.sort(comparePlacements);
      sceneInsert.run(id, scene.dialogueId, scene.graphName, JSON.stringify(scene.placements));
      scene.placements.forEach((placement, ordinal) => {
        const placementId = `${id}#${ordinal}`;
        placementInsert.run(
          placementId,
          id,
          ordinal,
          placement.cell,
          placement.map ?? null,
          placement.speakerName ?? null,
          placement.interactionText ?? null,
          JSON.stringify(placement.position),
        );
        const point = sourceToMapPoint(placement.position);
        mapPlacementInsert.run(
          "scene-dialogue",
          placementId,
          placement.map ?? null,
          point.x,
          point.y,
          point.elevation,
          JSON.stringify({ kind: "sceneObject", id: placementId }),
        );
      });
    }
  });
  tx();
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function comparePlacements(
  left: SceneDialoguePlacementSnapshot,
  right: SceneDialoguePlacementSnapshot,
): number {
  if (left.cell !== right.cell) return left.cell < right.cell ? -1 : 1;
  if (left.position.x !== right.position.x) return left.position.x - right.position.x;
  if (left.position.y !== right.position.y) return left.position.y - right.position.y;
  return left.position.z - right.position.z;
}
