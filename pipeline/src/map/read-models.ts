import type { Database } from "bun:sqlite";
import { entityRegistry } from "../entities/registry";
import {
  ENTITY_GRAPH_DDL,
  insertPipelineDiagnostics,
} from "../relationships/relationship-graph.ts";
import type { PipelineDiagnostic } from "../relationships/relationship-graph.ts";

export const MAP_READ_MODEL_DDL = `
CREATE TABLE map_points (
  id                         TEXT PRIMARY KEY,
  entity_id                  TEXT NOT NULL,
  instance_id                TEXT NOT NULL,
  name                       TEXT,
  map_id                     TEXT,
  map_x                      REAL NOT NULL,
  map_y                      REAL NOT NULL,
  elevation                  REAL NOT NULL,
  enabled                    INTEGER NOT NULL,
  show_on_map_debug_only     INTEGER NOT NULL,
  allow_fast_travel          INTEGER NOT NULL
);
CREATE INDEX idx_map_points_entity_id_map_id ON map_points (entity_id, map_id);
CREATE TABLE map_volumes (
  id                         TEXT PRIMARY KEY,
  entity_id                  TEXT NOT NULL,
  instance_id                TEXT NOT NULL,
  name                       TEXT NOT NULL,
  map_id                     TEXT,
  geometry_json              TEXT NOT NULL,
  elevation_min              REAL,
  elevation_max              REAL
);
CREATE INDEX idx_map_volumes_entity_id_map_id ON map_volumes (entity_id, map_id);
`;

function mapLayerId(db: Database, entityId: string): string {
  const hasMapLayers = db
    .query<{ count: number }, []>(
      `SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'map_layers'`,
    )
    .get()?.count;
  if (!hasMapLayers) return entityId;
  return (
    db
      .query<{ layer_id: string }, [string]>(
        `SELECT layer_id FROM map_layers WHERE entity_id = ? LIMIT 1`,
      )
      .get(entityId)?.layer_id ?? entityId
  );
}

function mapProjectionDiagnostics(
  db: Database,
  entityId: string,
  sourceTable: string | undefined,
  sourceRows: number,
  outputRows: number,
): PipelineDiagnostic[] {
  if (sourceTable === undefined || sourceRows === 0 || outputRows > 0) return [];
  const layer = mapLayerId(db, entityId);
  return [
    {
      severity: "diagnostic",
      source: "map-read-model",
      code: "mapLayerEmptyProjection",
      message: `Map layer '${layer}' has no points or volumes although source table '${sourceTable}' has ${sourceRows} rows.`,
      entityType: entityId,
      entityId: null,
      field: "map",
      evidence: { layer, sourceTable, sourceRows, outputRows },
    },
  ];
}

/**
 * Emits `map_points` and `map_volumes` for exactly the placed entities named in
 * `entityIds`. Entity nodes come from each entity's canonical read model.
 * The projection is supplied by the descriptor-driven entity registry. Callers
 * derive that list from descriptors plus present snapshot envelopes, so a
 * missing projection is a contract error rather than a silently empty map.
 */
export function emitMapReadModels(
  db: Database,
  entityIds: readonly string[],
  _mapRoute = "/map",
): void {
  db.exec(MAP_READ_MODEL_DDL);
  db.exec(ENTITY_GRAPH_DDL);

  const diagnostics: PipelineDiagnostic[] = [];
  for (const entityId of entityIds) {
    const projection = entityRegistry[entityId]?.mapProjection;
    if (!projection) {
      throw new Error(`emit-map-read-models: no map projection for entity '${entityId}'`);
    }
    db.exec(projection.points);
    if (projection.volumes) db.exec(projection.volumes);
    const sourceRows = projection.sourceTable
      ? (db
          .query<{ count: number }, []>(`SELECT COUNT(*) AS count FROM ${projection.sourceTable}`)
          .get()?.count ?? 0)
      : 0;
    const outputRows =
      (db
        .query<{ count: number }, [string]>(
          `SELECT COUNT(*) AS count FROM map_points WHERE entity_id = ?`,
        )
        .get(entityId)?.count ?? 0) +
      (db
        .query<{ count: number }, [string]>(
          `SELECT COUNT(*) AS count FROM map_volumes WHERE entity_id = ?`,
        )
        .get(entityId)?.count ?? 0);
    diagnostics.push(
      ...mapProjectionDiagnostics(db, entityId, projection.sourceTable, sourceRows, outputRows),
    );
  }
  insertPipelineDiagnostics(db, diagnostics, "map-read-model");
}
