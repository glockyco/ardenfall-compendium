import { findSameNameChainRoot, loadRaceChain } from "./character-race/chain";
import type { Database } from "bun:sqlite";
import type { SnapshotRef } from "../types.ts";

export interface CharacterTypeResolution {
  id: string;
  label: string;
  routePath: string | null;
}

interface CharacterDefinitionRow {
  id: string;
  character_name: string | null;
  parent_ref_json: string | null;
  race_ref_json: string | null;
}

interface EntityNodeRow {
  entity_id: string;
  label: string | null;
  route_path: string | null;
  has_page: number;
}

/** Resolve the player-facing type without branching on character family. */
export function resolveCharacterType(
  db: Database,
  definitionId: string,
): CharacterTypeResolution | null {
  const definitions = new Map(
    db
      .query<CharacterDefinitionRow, []>(
        `SELECT id, character_name, parent_ref_json, race_ref_json FROM characters`,
      )
      .all()
      .map((row) => [row.id, row] as const),
  );
  const nodes = new Map(
    db
      .query<EntityNodeRow, []>(
        `SELECT entity_id, label, route_path, has_page
         FROM entity_nodes
         WHERE entity_type IN ('character', 'character-race')`,
      )
      .all()
      .map((row) => [row.entity_id, row] as const),
  );
  const visited = new Set<string>();
  let currentId: string | null = definitionId;
  while (currentId !== null && !visited.has(currentId)) {
    visited.add(currentId);
    const row = definitions.get(currentId);
    if (!row) break;
    const label = row.character_name?.trim();
    if (label) return makeResolution(currentId, label, nodes);
    currentId = resolveReferenceId(row.parent_ref_json, "character");
  }

  const definition = definitions.get(definitionId);
  if (!definition) return null;
  const raceId = resolveReferenceId(definition.race_ref_json, "character-race");
  if (raceId === null) return null;
  // A definition references whichever race variant the game gave it, and the
  // variants of one race share a page. Resolving to the variant would point at a
  // record with no page, so the type is the race a reader can open.
  const raceChain = loadRaceChain(db);
  const raceRow = raceChain.get(raceId);
  const readerFacingRaceId = raceRow ? findSameNameChainRoot(raceRow, raceChain) : raceId;
  const raceNode = nodes.get(readerFacingRaceId);
  const raceLabel = raceNode?.has_page === 1 ? raceNode.label?.trim() : null;
  if (!raceLabel || raceLabel === "Unnamed race") return null;
  return makeResolution(readerFacingRaceId, raceLabel, nodes);
}

function makeResolution(
  id: string,
  label: string,
  nodes: ReadonlyMap<string, EntityNodeRow>,
): CharacterTypeResolution {
  const node = nodes.get(id);
  return {
    id,
    label,
    routePath: node?.has_page === 1 ? node.route_path : null,
  };
}

export function resolveReferenceId(value: string | null, entity: string): string | null {
  if (value === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const ref = parsed as Partial<SnapshotRef>;
  if (ref.kind === "lookupAsset" && typeof ref.guid === "string") return ref.guid;
  if (ref.kind === "namedAsset" && ref.entity === entity && typeof ref.name === "string") {
    return `named;${entity};${ref.name}`;
  }
  return null;
}
