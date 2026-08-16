import { findSameNameChainRoot } from "./chain";
import type { Database } from "bun:sqlite";
import { ENTITY_GRAPH_DDL } from "../../relationships/relationship-graph.ts";
import type { SnapshotRef } from "../../types.ts";
import { deriveEntityNodeSlug, prepareEntityNodeWriter } from "../../relationships/entity-nodes.ts";

export const CHARACTER_RACE_READ_MODEL_DDL = `
CREATE TABLE character_race_overview_rows (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  variant_count  INTEGER NOT NULL
);
CREATE TABLE character_race_presentation_rows (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  render_context    TEXT NOT NULL,
  variants_json     TEXT NOT NULL
);
`;

interface CharacterRaceRow {
  id: string;
  race_name: string | null;
  name_set_refs_json: string;
  parent_ref_json: string | null;
}

interface CharacterRaceVariant {
  id: string;
  nameSetRefs: SnapshotRef[];
}

export function emitCharacterRaceReadModels(db: Database, routeBase = "/races"): void {
  db.exec(CHARACTER_RACE_READ_MODEL_DDL);
  db.exec(ENTITY_GRAPH_DDL);
  const overviewInsert = db.prepare(
    `INSERT INTO character_race_overview_rows (id, name, variant_count) VALUES (?, ?, ?)`,
  );
  const presentationInsert = db.prepare(
    `INSERT INTO character_race_presentation_rows (
      id, name, render_context, variants_json
    ) VALUES (?, ?, ?, ?)`,
  );
  const writeNode = prepareEntityNodeWriter(db);
  const rows = db
    .query<CharacterRaceRow, []>(
      `SELECT id, race_name, name_set_refs_json, parent_ref_json
       FROM character_races
       ORDER BY id`,
    )
    .all();
  const byId = new Map(rows.map((row) => [row.id, row]));
  const groups = new Map<string, { name: string; variants: CharacterRaceVariant[] }>();

  for (const row of rows) {
    const name = row.race_name?.trim() || null;
    const rootId = name === null ? null : findSameNameChainRoot(row, byId);
    if (rootId !== null) {
      const group = groups.get(rootId) ?? { name: name!, variants: [] };
      // The page represents the chain root, so include the root as a variant. It authored the
      // reader-facing name and must not disappear from the page's list of source assets.
      group.variants.push({
        id: row.id,
        nameSetRefs: parseNameSetRefs(row.name_set_refs_json, row.id),
      });
      groups.set(rootId, group);
    }
  }

  const tx = db.transaction(() => {
    for (const row of rows) {
      const name = row.race_name?.trim() || "Unnamed race";
      const rootId = row.race_name?.trim() ? findSameNameChainRoot(row, byId) : null;
      const group = rootId === null ? null : groups.get(rootId);
      const slug = group && rootId === row.id ? deriveEntityNodeSlug(group.name, row.id) : null;
      writeNode({
        entityType: "character-race",
        entityId: row.id,
        label: name,
        routePath: slug ? `${routeBase}/${slug.canonicalSlug}` : null,
        canonicalSlug: deriveEntityNodeSlug(name, row.id).canonicalSlug,
        shortId: deriveEntityNodeSlug(name, row.id).shortId,
        hasPage: group !== null && rootId === row.id,
      });
    }
    for (const [id, group] of groups) {
      group.variants.sort((left, right) => left.id.localeCompare(right.id));
      overviewInsert.run(id, group.name, group.variants.length);
      presentationInsert.run(
        id,
        group.name,
        "character-race-presentation-v1",
        JSON.stringify(group.variants),
      );
    }
  });
  tx();
}

function parseNameSetRefs(value: string, raceId: string): SnapshotRef[] {
  let refs: unknown;
  try {
    refs = JSON.parse(value) as unknown;
  } catch (error) {
    throw new Error(`character race '${raceId}' has invalid name set references JSON`, {
      cause: error,
    });
  }
  if (!Array.isArray(refs)) {
    throw new Error(`character race '${raceId}' has non-array name set references JSON`);
  }
  return refs as SnapshotRef[];
}
