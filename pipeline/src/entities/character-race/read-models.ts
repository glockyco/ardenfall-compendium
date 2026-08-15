import type { Database } from "bun:sqlite";
import { ENTITY_GRAPH_DDL } from "../../relationships/relationship-graph.ts";
import { deriveEntityNodeSlug, prepareEntityNodeWriter } from "../item/read-models.ts";

export const CHARACTER_RACE_READ_MODEL_DDL = `
CREATE TABLE character_race_overview_rows (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  name_set_count INTEGER NOT NULL
);
CREATE TABLE character_race_presentation_rows (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  render_context    TEXT NOT NULL,
  name_set_refs_json TEXT NOT NULL
);
`;

interface CharacterRaceRow {
  id: string;
  race_name: string | null;
  name_set_refs_json: string;
}

export function emitCharacterRaceReadModels(db: Database, routeBase = "/races"): void {
  db.exec(CHARACTER_RACE_READ_MODEL_DDL);
  db.exec(ENTITY_GRAPH_DDL);
  const overviewInsert = db.prepare(
    `INSERT INTO character_race_overview_rows (id, name, name_set_count) VALUES (?, ?, ?)`,
  );
  const presentationInsert = db.prepare(
    `INSERT INTO character_race_presentation_rows (
      id, name, render_context, name_set_refs_json
    ) VALUES (?, ?, ?, ?)`,
  );
  const writeNode = prepareEntityNodeWriter(db);
  const rows = db
    .query<CharacterRaceRow, []>(
      `SELECT id, race_name, name_set_refs_json
       FROM character_races
       ORDER BY COALESCE(NULLIF(TRIM(race_name), ''), 'Unnamed race'), id`,
    )
    .all();

  const tx = db.transaction(() => {
    for (const row of rows) {
      const label = row.race_name?.trim() || "Unnamed race";
      const nameSetCount = countNameSetRefs(row.name_set_refs_json, row.id);
      overviewInsert.run(row.id, label, nameSetCount);
      presentationInsert.run(
        row.id,
        label,
        "character-race-presentation-v1",
        row.name_set_refs_json,
      );
      const slug = deriveEntityNodeSlug(label, row.id);
      writeNode({
        entityType: "character-race",
        entityId: row.id,
        label,
        routePath: `${routeBase}/${slug.canonicalSlug}`,
        canonicalSlug: slug.canonicalSlug,
        shortId: slug.shortId,
      });
    }
  });
  tx();
}

function countNameSetRefs(value: string, raceId: string): number {
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
  return refs.length;
}
