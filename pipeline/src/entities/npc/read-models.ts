import type { Database } from "bun:sqlite";
import type { PipelineDiagnostic } from "../../relationships/relationship-graph.ts";
import { deriveEntityNodeSlug, prepareEntityNodeWriter } from "../item/read-models.ts";

interface NpcRow {
  id: string;
  record_ref_json: string;
  display_name: string | null;
  display_name_provenance: string;
  display_name_owner: string | null;
}

interface NpcPlacementRow {
  instance_id: string;
  map_id: string | null;
  map_x: number;
  map_y: number;
  elevation: number;
}

interface NpcLocationRefRow {
  id: string;
  npc_id: string;
  location_id: string | null;
  ref_json: string;
}

export function emitNpcReadModels(db: Database): PipelineDiagnostic[] {
  const diagnostics: PipelineDiagnostic[] = [];
  const writeNode = prepareEntityNodeWriter(db);
  const npcRows = db
    .query<NpcRow, []>(
      `SELECT id, record_ref_json, display_name, display_name_provenance, display_name_owner
       FROM npcs
       ORDER BY COALESCE(display_name, 'Unnamed character'), id`,
    )
    .all();
  const placements = new Map(
    db
      .query<NpcPlacementRow, []>(
        `SELECT instance_id, map_id, map_x, map_y, elevation
         FROM placements
         WHERE entity_id = 'npc'
         ORDER BY instance_id`,
      )
      .all()
      .map((row) => [row.instance_id, row] as const),
  );
  const refs = db
    .query<NpcLocationRefRow, []>(
      `SELECT id, npc_id, location_id, ref_json
       FROM npc_location_refs
       ORDER BY npc_id, id`,
    )
    .all();
  const refsByNpc = new Map<string, NpcLocationRefRow[]>();
  for (const ref of refs) {
    const npcRefs = refsByNpc.get(ref.npc_id) ?? [];
    npcRefs.push(ref);
    refsByNpc.set(ref.npc_id, npcRefs);
  }
  const locationNodes = new Set(
    db
      .query<{ entity_id: string }, []>(
        `SELECT entity_id FROM entity_nodes WHERE entity_type = 'location'`,
      )
      .all()
      .map((row) => row.entity_id),
  );
  const presentationInsert = db.prepare(
    `INSERT INTO npc_presentation_rows (
      id, name, display_name_provenance, display_name_owner, render_context,
      map_id, map_x, map_y, elevation, location_ids_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const nodeTx = db.transaction(() => {
    for (const row of npcRows) {
      // An absent name is an observation about game data, so extraction owns the
      // diagnostic and emits `npcDisplayNameMissing` per row. Repeating it here
      // would report one fact twice, in two artifacts. The read model's job is to
      // publish the absence: `display_name` stays null and the provenance says
      // `absent`, which is what the page states.
      const label = row.display_name ?? "Unnamed character";
      const placement = placements.get(row.id);
      if (!placement) {
        throw new Error(`NPC '${row.id}' has no canonical placement`);
      }
      const slug = deriveEntityNodeSlug(label, row.id);
      const locationIds = [
        ...new Set(
          (refsByNpc.get(row.id) ?? [])
            .map((ref) => ref.location_id)
            .filter(
              (locationId): locationId is string =>
                locationId !== null && locationNodes.has(locationId),
            ),
        ),
      ];
      presentationInsert.run(
        row.id,
        label,
        row.display_name_provenance,
        row.display_name_owner,
        "placed-character-presentation-v1",
        placement.map_id,
        placement.map_x,
        placement.map_y,
        placement.elevation,
        JSON.stringify(locationIds),
      );
      writeNode({
        entityType: "npc",
        entityId: row.id,
        label,
        routePath: `/placed-characters/${slug.canonicalSlug}`,
        canonicalSlug: slug.canonicalSlug,
        shortId: slug.shortId,
        hasPage: true,
      });
    }
  });
  nodeTx();

  const npcById = new Map(npcRows.map((row) => [row.id, row]));
  const edgeInsert = db.prepare(
    `INSERT OR IGNORE INTO entity_edges (
      edge_id, source_type, source_id, target_type, target_id,
      predicate, label, weight, evidence_json, anchor
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const seenPairs = new Set<string>();
  const edgeTx = db.transaction(() => {
    for (const ref of refs) {
      const npc = npcById.get(ref.npc_id);
      if (!npc) {
        diagnostics.push({
          severity: "diagnostic",
          source: "relationship-graph",
          code: "npcLocationNpcUnresolved",
          message: `NPC location reference '${ref.id}' targets missing NPC '${ref.npc_id}'.`,
          entityType: "npc",
          entityId: ref.npc_id,
          field: "npc_location_refs.npc_id",
        });
        continue;
      }
      if (!ref.location_id) {
        diagnostics.push({
          severity: "diagnostic",
          source: "relationship-graph",
          code: "npcLocationUnresolved",
          message: `NPC '${ref.npc_id}' has a location reference that cannot identify a location.`,
          entityType: "npc",
          entityId: ref.npc_id,
          field: "npc_location_refs.ref_json",
          evidence: { referenceId: ref.id, ref: JSON.parse(ref.ref_json) },
        });
        continue;
      }
      if (!locationNodes.has(ref.location_id)) {
        diagnostics.push({
          severity: "diagnostic",
          source: "relationship-graph",
          code: "npcLocationUnresolved",
          message: `NPC '${ref.npc_id}' references location '${ref.location_id}', which is not published.`,
          entityType: "npc",
          entityId: ref.npc_id,
          field: "npc_location_refs.location_id",
          evidence: { referenceId: ref.id, locationId: ref.location_id },
        });
        continue;
      }
      const pair = `${ref.npc_id}\0${ref.location_id}`;
      if (seenPairs.has(pair)) continue;
      seenPairs.add(pair);
      edgeInsert.run(
        `${ref.npc_id}:found_at:location:${ref.location_id}`,
        "npc",
        ref.npc_id,
        "location",
        ref.location_id,
        "found_at",
        "Found at",
        1,
        JSON.stringify({
          source: "NPCRecord.SpawnPoint",
          npcRecordId: ref.npc_id,
          npcRecordRef: JSON.parse(npc.record_ref_json),
          containmentTest: "LocationAsset.IsInside",
          containmentSource: "game's own test",
        }),
        null,
      );
    }
  });
  edgeTx();

  return diagnostics;
}
