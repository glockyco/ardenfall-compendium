import type { Database } from "bun:sqlite";
import type { SnapshotRef } from "../../types.ts";
import { resolveCharacterType, resolveReferenceId } from "../character-type.ts";
import type { CharacterTypeResolution } from "../character-type.ts";
import type { PipelineDiagnostic } from "../../relationships/relationship-graph.ts";
import { deriveEntityNodeSlug, prepareEntityNodeWriter } from "../item/read-models.ts";

interface NpcRow {
  id: string;
  record_ref_json: string;
  character_ref_json: string | null;
  display_name: string | null;
  display_name_provenance: string;
  display_name_owner: string | null;
  drop_refs_json: string;
  drop_refs_provenance: string;
  drop_refs_owner: string | null;
  merchant_refs_json: string;
  merchant_refs_provenance: string;
  merchant_refs_owner: string | null;
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

interface LocationNodeRow {
  entity_id: string;
  label: string | null;
  display_label: string | null;
}

export function emitNpcReadModels(db: Database, routeBase: string): PipelineDiagnostic[] {
  const diagnostics: PipelineDiagnostic[] = [];
  const writeNode = prepareEntityNodeWriter(db);
  const npcRows = db
    .query<NpcRow, []>(
      `SELECT npcs.id, npcs.record_ref_json, npcs.character_ref_json, npcs.display_name,
              npcs.drop_refs_json, npcs.merchant_refs_json,
              provenance.provenance AS display_name_provenance,
              provenance.owner AS display_name_owner,
              drop_provenance.provenance AS drop_refs_provenance,
              drop_provenance.owner AS drop_refs_owner,
              merchant_provenance.provenance AS merchant_refs_provenance,
              merchant_provenance.owner AS merchant_refs_owner
       FROM npcs
       JOIN npc_value_provenance AS provenance
         ON provenance.npc_id = npcs.id
        AND provenance.field_name = 'displayName'
       JOIN npc_value_provenance AS drop_provenance
         ON drop_provenance.npc_id = npcs.id
        AND drop_provenance.field_name = 'dropRefs'
       JOIN npc_value_provenance AS merchant_provenance
         ON merchant_provenance.npc_id = npcs.id
        AND merchant_provenance.field_name = 'merchantRefs'
       ORDER BY COALESCE(npcs.display_name, npcs.id), npcs.id`,
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
  const locationNodes = new Map(
    db
      .query<LocationNodeRow, []>(
        `SELECT entity_id, label, display_label
         FROM entity_nodes
         WHERE entity_type = 'location'`,
      )
      .all()
      .map((row) => [row.entity_id, row] as const),
  );
  const characterNodes = new Map(
    db
      .query<{ entity_id: string; has_page: number }, []>(
        `SELECT entity_id, has_page
         FROM entity_nodes
         WHERE entity_type = 'character' AND has_page = 1`,
      )
      .all()
      .map((row) => [row.entity_id, row] as const),
  );
  const itemNodes = new Set(
    db
      .query<{ entity_id: string }, []>(
        `SELECT entity_id
         FROM entity_nodes
         WHERE entity_type = 'item'`,
      )
      .all()
      .map((row) => row.entity_id),
  );
  const definitionByNpc = new Map<string, string>();
  const characterTypeByNpc = new Map<string, CharacterTypeResolution | null>();
  for (const row of npcRows) {
    const definitionId = resolveReferenceId(row.character_ref_json, "character");
    if (definitionId === null || !characterNodes.has(definitionId)) {
      diagnostics.push({
        severity: "diagnostic",
        source: "relationship-graph",
        code: "npcCharacterReferenceUnresolved",
        message: `NPC '${row.id}' has an unresolvable character reference.`,
        entityType: "npc",
        entityId: row.id,
        field: "npcs.character_ref_json",
        evidence: { characterRefJson: row.character_ref_json },
      });
      continue;
    }
    definitionByNpc.set(row.id, definitionId);
    characterTypeByNpc.set(row.id, resolveCharacterType(db, definitionId));
  }
  const presentationInsert = db.prepare(
    `INSERT INTO npc_presentation_rows (
      id, name, name_is_description, display_name_provenance, display_name_owner, render_context,
      map_id, map_x, map_y, elevation, location_ids_json,
      character_type_id, character_type_label, character_type_route_path
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const nodeTx = db.transaction(() => {
    for (const row of npcRows) {
      // An absent name is an observation about game data, so extraction owns the
      // diagnostic and emits `npcDisplayNameMissing` per row. Repeating it here
      // would report one fact twice, in two artifacts. The read model's job is to
      // publish the absence: `display_name` stays null and the provenance says
      // `absent`, which is what the page states.
      const placement = placements.get(row.id);
      if (!placement) {
        throw new Error(`NPC '${row.id}' has no canonical placement`);
      }
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
      const characterType = characterTypeByNpc.get(row.id) ?? null;
      // A placement can sit in several containing volumes, so the title names them
      // in a fixed order rather than whichever row the query returned first: a
      // title that moves with row order is not a stable page name.
      const locationLabel = locationIds
        .map((locationId) => locationNodes.get(locationId))
        .map((node) => node?.label?.trim() || node?.display_label?.trim())
        .filter((label): label is string => Boolean(label))
        .sort((left, right) => left.localeCompare(right))[0];
      const isDescription = row.display_name === null;
      // A character the game names at runtime is titled by description, composed
      // only from facts already published: what it is, and where it stands.
      const description =
        characterType?.label && locationLabel
          ? `${characterType.label} in ${locationLabel}`
          : (characterType?.label ??
            (locationLabel
              ? `Character in ${locationLabel}`
              : `Character ${deriveEntityNodeSlug("", row.id).shortId}`));
      const label = row.display_name ?? description;
      const slug = deriveEntityNodeSlug(label, row.id);
      presentationInsert.run(
        row.id,
        label,
        isDescription ? 1 : 0,
        row.display_name_provenance,
        row.display_name_owner,
        "character-presentation-v1",
        placement.map_id,
        placement.map_x,
        placement.map_y,
        placement.elevation,
        JSON.stringify(locationIds),
        characterType?.id ?? null,
        characterType?.label ?? null,
        characterType?.routePath ?? null,
      );
      writeNode({
        entityType: "npc",
        entityId: row.id,
        label,
        routePath: `${routeBase}/${slug.canonicalSlug}`,
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
    for (const [npcId, definitionId] of definitionByNpc) {
      edgeInsert.run(
        `${npcId}:instance_of:character:${definitionId}`,
        "npc",
        npcId,
        "character",
        definitionId,
        "instance_of",
        "Character type",
        1,
        JSON.stringify({ source: "npcs.character_ref_json" }),
        null,
      );
    }
    for (const row of npcRows) {
      const drops = parseNpcItemRefs(
        row.drop_refs_json,
        row,
        "npcs.drop_refs_json",
        "npcDropUnresolved",
        diagnostics,
      );
      for (const ref of drops) {
        const targetId = itemReferenceId(ref);
        const itemId = targetId !== null && itemNodes.has(targetId) ? targetId : null;
        if (itemId === null) {
          if (isItemReference(ref)) {
            diagnostics.push(
              unresolvedNpcItemDiagnostic(
                row,
                "npcs.drop_refs_json",
                "npcDropUnresolved",
                "reference does not identify a published item",
              ),
            );
          }
          continue;
        }
        edgeInsert.run(
          `${row.id}:can_drop:item:${itemId}`,
          "npc",
          row.id,
          "item",
          itemId,
          "can_drop",
          "Can drop",
          1,
          JSON.stringify({
            source: "npcs.drop_refs_json",
            provenance: row.drop_refs_provenance,
            owner: row.drop_refs_owner ?? row.id,
            ownerType: row.drop_refs_provenance === "own" ? "placement" : "character",
          }),
          null,
        );
      }

      const stock = parseNpcItemRefs(
        row.merchant_refs_json,
        row,
        "npcs.merchant_refs_json",
        "npcMerchantReferenceUnresolved",
        diagnostics,
      );
      for (const ref of stock) {
        const targetId = itemReferenceId(ref);
        const itemId = targetId !== null && itemNodes.has(targetId) ? targetId : null;
        if (itemId === null) {
          if (isItemReference(ref)) {
            diagnostics.push(
              unresolvedNpcItemDiagnostic(
                row,
                "npcs.merchant_refs_json",
                "npcMerchantReferenceUnresolved",
                "reference does not identify a published item",
              ),
            );
          }
          continue;
        }
        edgeInsert.run(
          `${itemId}:sold_by:npc:${row.id}`,
          "item",
          itemId,
          "npc",
          row.id,
          "sold_by",
          "Sold by",
          1,
          JSON.stringify({
            source: "npcs.merchant_refs_json",
            provenance: row.merchant_refs_provenance,
            owner: row.merchant_refs_owner ?? row.id,
            ownerType: row.merchant_refs_provenance === "own" ? "placement" : "character",
          }),
          null,
        );
      }
    }
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

function parseNpcItemRefs(
  value: string,
  row: NpcRow,
  field: string,
  code: "npcDropUnresolved" | "npcMerchantReferenceUnresolved",
  diagnostics: PipelineDiagnostic[],
): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    diagnostics.push(
      unresolvedNpcItemDiagnostic(row, field, code, "reference list is not valid JSON"),
    );
    return [];
  }
  if (!Array.isArray(parsed)) {
    diagnostics.push(
      unresolvedNpcItemDiagnostic(row, field, code, "reference list is not an array"),
    );
    return [];
  }
  for (const ref of parsed) {
    if (!isItemReference(ref)) {
      diagnostics.push(
        unresolvedNpcItemDiagnostic(row, field, code, "reference does not identify an item"),
      );
    }
  }
  return parsed;
}

function itemReferenceId(value: unknown): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const ref = value as Partial<SnapshotRef>;
  if (ref.kind === "lookupAsset" && typeof ref.guid === "string") return ref.guid;
  if (ref.kind === "namedAsset" && ref.entity === "item" && typeof ref.name === "string") {
    return `named;item;${ref.name}`;
  }
  return null;
}

function isItemReference(value: unknown): boolean {
  return itemReferenceId(value) !== null;
}

function unresolvedNpcItemDiagnostic(
  row: NpcRow,
  field: string,
  code: "npcDropUnresolved" | "npcMerchantReferenceUnresolved",
  reason: string,
): PipelineDiagnostic {
  const kind = code === "npcDropUnresolved" ? "drop" : "merchant";
  return {
    severity: "diagnostic",
    source: "relationship-graph",
    code,
    message: `NPC '${row.id}' has an unresolvable ${kind} item reference: ${reason}.`,
    entityType: "npc",
    entityId: row.id,
    field,
    evidence: { reason },
  };
}
