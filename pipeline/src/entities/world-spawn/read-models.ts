import type { Database } from "bun:sqlite";
import { deriveEntityNodeSlug, prepareEntityNodeWriter } from "../../relationships/entity-nodes.ts";
import type { PipelineDiagnostic } from "../../relationships/relationship-graph.ts";
import type { SnapshotRef } from "../../types.ts";

interface WorldSpawnRow {
  id: string;
  cell: string;
  map_id: string | null;
  kind: string;
  character_ref_json: string | null;
  record_ref_json: string | null;
}

interface SpawnTarget {
  type: "character" | "npc";
  id: string;
  name: string;
}

/**
 * Publishes what the authored scenes instantiate.
 *
 * A `local` spawner names a character definition, so its edge runs to that definition and the
 * definition page gains the places the world spawns it. A `record` spawner is the scene side of a
 * placement the record table already carries, so its edge runs to that placed character.
 *
 * An absence of records is not evidence that a player cannot meet a definition, so nothing here
 * asserts that. The edges say what the scenes reference; silence stays silence.
 *
 * Must run after the map read models, which create the graph tables.
 */
export function emitWorldSpawnReadModels(
  db: Database,
  routeBase = "/world-spawns",
): PipelineDiagnostic[] {
  const diagnostics: PipelineDiagnostic[] = [];
  const rows = db
    .query<WorldSpawnRow, []>(
      `SELECT id, cell, map_id, kind, character_ref_json, record_ref_json
       FROM world_spawns ORDER BY id`,
    )
    .all();
  const definitions = new Map(
    db
      .query<{ id: string; name: string | null }, []>(
        `SELECT id, character_name AS name FROM characters`,
      )
      .all()
      .map((row) => [row.id, row.name]),
  );
  const placedCharacters = new Map(
    db
      .query<{ id: string; name: string }, []>(
        `SELECT n.entity_id AS id, n.display_label AS name FROM entity_nodes n
         WHERE n.entity_type = 'npc'`,
      )
      .all()
      .map((row) => [row.id, row.name]),
  );

  const writeNode = prepareEntityNodeWriter(db);
  const presentationInsert = db.prepare(
    `INSERT INTO world_spawn_presentation_rows (
      id, name, render_context, cell, map_id, map_x, map_y, elevation, kind,
      target_type, target_id, target_name
    ) VALUES (?, ?, 'world-spawn-presentation-v1', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const edgeInsert = db.prepare(
    `INSERT OR IGNORE INTO entity_edges (
      edge_id, source_type, source_id, target_type, target_id, predicate, label, weight,
      evidence_json, anchor
    ) VALUES (?, 'world-spawn', ?, ?, ?, 'spawns_character', ?, 1, ?, NULL)`,
  );
  const pointQuery = db.query<
    { map_x: number | null; map_y: number | null; elevation: number | null },
    [string]
  >(
    `SELECT map_x, map_y, elevation FROM placements
     WHERE entity_id = 'world-spawn' AND instance_id = ?`,
  );

  const tx = db.transaction(() => {
    for (const row of rows) {
      const target = resolveTarget(row, definitions, placedCharacters);
      const label = `${target?.name ?? "Unresolved spawn"} (${row.cell})`;
      const slug = deriveEntityNodeSlug(label, row.id);
      writeNode({
        entityType: "world-spawn",
        entityId: row.id,
        label,
        routePath: `${routeBase}/${slug.canonicalSlug}`,
        canonicalSlug: slug.canonicalSlug,
        shortId: slug.shortId,
        hasPage: true,
      });

      const point = pointQuery.get(row.id);
      presentationInsert.run(
        row.id,
        label,
        row.cell,
        row.map_id,
        point?.map_x ?? null,
        point?.map_y ?? null,
        point?.elevation ?? null,
        row.kind,
        target?.type ?? null,
        target?.id ?? null,
        target?.name ?? null,
      );

      if (target === null) {
        diagnostics.push({
          severity: "diagnostic",
          source: "relationship-graph",
          code: "worldSpawnUnresolved",
          message: `World spawn '${row.id}' references a ${row.kind === "local" ? "definition" : "record"} the snapshot does not carry.`,
          entityType: "world-spawn",
          entityId: row.id,
          field: row.kind === "local" ? "character_ref_json" : "record_ref_json",
          evidence: { cell: row.cell, kind: row.kind },
        });
        continue;
      }

      edgeInsert.run(
        `world-spawn:${row.id}|spawns_character|${target.type}:${target.id}`,
        row.id,
        target.type,
        target.id,
        row.kind === "local" ? "Spawned by the world" : "Placed in the world",
        JSON.stringify({ cell: row.cell, kind: row.kind }),
      );
    }
  });
  tx();

  writeDefinitionReach(db);

  return diagnostics;
}

/**
 * Records how the authored scenes reach each character definition.
 *
 * `none` says that no placement and no spawner in the authored scenes references the definition.
 * It does not say a player cannot meet it: a random spawner group can select a definition at
 * runtime, and that choice is not authored anywhere the walk can read.
 */
function writeDefinitionReach(db: Database): void {
  const insert = db.prepare(
    `INSERT OR REPLACE INTO character_world_reach (character_id, reach) VALUES (?, ?)`,
  );
  const placed = new Set(
    db
      .query<{ id: string }, []>(
        `SELECT DISTINCT target_id AS id FROM entity_edges
         WHERE predicate = 'instance_of' AND target_type = 'character'`,
      )
      .all()
      .map((row) => row.id),
  );
  const spawned = new Set(
    db
      .query<{ id: string }, []>(
        `SELECT DISTINCT target_id AS id FROM entity_edges
         WHERE predicate = 'spawns_character' AND target_type = 'character'`,
      )
      .all()
      .map((row) => row.id),
  );
  const definitions = db.query<{ id: string }, []>(`SELECT id FROM characters`).all();

  const tx = db.transaction(() => {
    for (const definition of definitions) {
      const isPlaced = placed.has(definition.id);
      const isSpawned = spawned.has(definition.id);
      const reach =
        isPlaced && isSpawned ? "both" : isPlaced ? "placement" : isSpawned ? "spawner" : "none";
      insert.run(definition.id, reach);
    }
  });
  tx();
}

/**
 * How many character definitions the authored scenes reach, and by which mechanism.
 *
 * Reported so a reader of the manifest can see the ratio rather than infer it, and so the claim
 * "nothing references this definition" stays a measurement rather than an assumption.
 */
export function countDefinitionReachability(db: Database): {
  byPlacement: number;
  bySpawner: number;
  byBoth: number;
  byNeither: number;
} {
  // A partial artifact carries only the families its snapshot held, so a database with no
  // character definitions reaches none of them rather than failing the manifest.
  const hasDefinitions = db
    .query<{ count: number }, []>(
      `SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'characters'`,
    )
    .get()?.count;
  if (!hasDefinitions) return { byBoth: 0, byNeither: 0, byPlacement: 0, bySpawner: 0 };

  const definitions = db
    .query<{ id: string }, []>(`SELECT id FROM characters`)
    .all()
    .map((row) => row.id);
  const placed = new Set(
    db
      .query<{ character_id: string }, []>(
        `SELECT DISTINCT target_id AS character_id FROM entity_edges
         WHERE predicate = 'instance_of' AND target_type = 'character'`,
      )
      .all()
      .map((row) => row.character_id),
  );
  const spawned = new Set(
    db
      .query<{ character_id: string }, []>(
        `SELECT DISTINCT target_id AS character_id FROM entity_edges
         WHERE predicate = 'spawns_character' AND target_type = 'character'`,
      )
      .all()
      .map((row) => row.character_id),
  );

  let byPlacement = 0;
  let bySpawner = 0;
  let byBoth = 0;
  let byNeither = 0;
  for (const id of definitions) {
    const isPlaced = placed.has(id);
    const isSpawned = spawned.has(id);
    if (isPlaced && isSpawned) byBoth += 1;
    else if (isPlaced) byPlacement += 1;
    else if (isSpawned) bySpawner += 1;
    else byNeither += 1;
  }

  return { byBoth, byNeither, byPlacement, bySpawner };
}

function resolveTarget(
  row: WorldSpawnRow,
  definitions: Map<string, string | null>,
  placedCharacters: Map<string, string>,
): SpawnTarget | null {
  if (row.kind === "local" && row.character_ref_json !== null) {
    const id = definitionId(JSON.parse(row.character_ref_json) as Partial<SnapshotRef>);
    if (id === null || !definitions.has(id)) return null;
    return { id, name: definitions.get(id) ?? id, type: "character" };
  }
  if (row.kind === "record" && row.record_ref_json !== null) {
    const id = recordId(JSON.parse(row.record_ref_json) as Partial<SnapshotRef>);
    if (id === null || !placedCharacters.has(id)) return null;
    return { id, name: placedCharacters.get(id) ?? id, type: "npc" };
  }
  return null;
}

/** A character definition is published under `named;character;<assetName>`. */
function definitionId(ref: Partial<SnapshotRef>): string | null {
  return ref.kind === "namedAsset" && ref.entity === "character" && typeof ref.name === "string"
    ? `named;character;${ref.name}`
    : null;
}

function recordId(ref: Partial<SnapshotRef>): string | null {
  if (ref.kind !== "record") return null;
  const { table, subtable, id } = ref;
  if (typeof table !== "string" || typeof subtable !== "string" || typeof id !== "string") {
    return null;
  }
  return `${table};${subtable};${id}`;
}
