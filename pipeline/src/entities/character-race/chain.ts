import type { Database } from "bun:sqlite";

/**
 * Resolves the reader-facing race for any race record.
 *
 * Races form a prototype chain and `raceName` is inherited along it, so several
 * records resolve one name: measured live, 112 records carry 3 reader-facing
 * names, and `race_karu-elf_male` re-authors the same text its parent authored.
 * A reader-facing race is therefore the topmost record in a chain resolving that
 * same name, which is the record that gets the page.
 *
 * Both the race pages and the character type fallback ask this question, so they
 * ask it here. Two copies would let a character point at a variant that has no
 * page, which is exactly what happened when the grouping first landed.
 */
export interface RaceChainRow {
  id: string;
  race_name: string | null;
  parent_ref_json: string | null;
}

export function loadRaceChain(db: Database): Map<string, RaceChainRow> {
  const rows = db
    .query<RaceChainRow, []>(`SELECT id, race_name, parent_ref_json FROM character_races`)
    .all();
  return new Map(rows.map((row) => [row.id, row]));
}

export function findSameNameChainRoot(row: RaceChainRow, byId: Map<string, RaceChainRow>): string {
  const name = row.race_name?.trim();
  if (!name) return row.id;
  let current = row;
  const visited = new Set<string>();
  while (!visited.has(current.id)) {
    visited.add(current.id);
    const parentId = parentIdFromJson(current.parent_ref_json, current.id);
    if (parentId === null) return current.id;
    const parent = byId.get(parentId);
    if (!parent || parent.race_name?.trim() !== name) return current.id;
    current = parent;
  }
  throw new Error(`character race parent cycle includes '${row.id}'`);
}

function parentIdFromJson(value: string | null, raceId: string): string | null {
  if (value === null) return null;
  let ref: unknown;
  try {
    ref = JSON.parse(value) as unknown;
  } catch {
    throw new Error(`character race '${raceId}' has a parent reference that is not valid JSON`);
  }
  if (ref === null || typeof ref !== "object") return null;
  const candidate = ref as { kind?: unknown; entity?: unknown; name?: unknown };
  if (candidate.kind !== "namedAsset") return null;
  if (typeof candidate.entity !== "string" || typeof candidate.name !== "string") return null;
  return `named;${candidate.entity};${candidate.name}`;
}
