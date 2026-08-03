import { Database } from "bun:sqlite";
import { mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import type { EntityDescriptor, Stage } from "../types.ts";
import { SITE_METADATA_DDL } from "../sql/site-metadata-ddl";
import { emitSiteMetadata } from "./emit-site-metadata";
import { emitReadModels } from "./emit-read-models";
import { entityRegistry, validateDescriptorCoverage } from "../entities/registry";
import { publishValidatedSqlite } from "../artifacts/sqlite-validation";
import type { LoadDescriptorsOutput } from "./load-descriptors.ts";
import type { LoadSnapshotOutput } from "./load-snapshot.ts";
import type { EmitAssetsOutput } from "./emit-assets.ts";
import type { ValidateOutput } from "./validate.ts";

export class SnapshotValidationError extends Error {
  constructor(public readonly validation: ValidateOutput) {
    super(`pipeline rejected snapshot: ${validation.countsBySeverity.fatal} fatal diagnostics`);
    this.name = "SnapshotValidationError";
  }
}

export function assertSnapshotValidationPassed(validation: ValidateOutput): void {
  if (validation.countsBySeverity.fatal > 0) {
    throw new SnapshotValidationError(validation);
  }
}

export function assertCanonicalTableContract(db: Database, entity: EntityDescriptor): void {
  const tableName = entity.canonicalTable;
  if (!tableName) {
    throw new Error(
      `entity '${entity.id}' canonical-table assertion failed: descriptor has no canonicalTable`,
    );
  }
  const table = db
    .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName) as { name: string } | null;
  if (!table) {
    throw new Error(
      `entity '${entity.id}' canonical-table assertion failed: canonical table '${tableName}' does not exist`,
    );
  }
  const actualColumns = (
    db.query(`PRAGMA table_info("${tableName}")`).all() as { name: string }[]
  ).map((column) => column.name);
  const declaredByColumn = new Map<string, string[]>();
  for (const field of entity.fields) {
    if (field.storage === "unstored") continue;
    const column = field.column ?? field.name;
    const fields = declaredByColumn.get(column) ?? [];
    fields.push(field.name);
    declaredByColumn.set(column, fields);
    if (!actualColumns.includes(column)) {
      throw new Error(
        `entity '${entity.id}' field '${field.name}' declares missing column '${column}' in canonical table '${tableName}' (field-to-column direction)`,
      );
    }
  }
  for (const column of actualColumns) {
    // Item's generated root table has a pipeline-owned variant discriminator.
    if (entity.id === "item" && column === "variant") continue;
    const fields = declaredByColumn.get(column) ?? [];
    if (fields.length !== 1) {
      const explanation =
        fields.length === 0 ? "no declared field" : `declared by fields '${fields.join("', '")}'`;
      throw new Error(
        `entity '${entity.id}' canonical table '${tableName}' column '${column}' has ${explanation} (column-to-field direction)`,
      );
    }
  }
}

export interface EmitSqliteInputs {
  "load-descriptors": LoadDescriptorsOutput;
  "load-snapshot": LoadSnapshotOutput;
  "emit-assets"?: EmitAssetsOutput;
  validate: ValidateOutput;
}

export interface EmitSqliteOutput {
  outputPath: string;
  byteSize: number;
}

function validateMappedSnapshotEnvelopes(
  desc: LoadDescriptorsOutput,
  snapshot: LoadSnapshotOutput,
): void {
  for (const [entityId, entity] of Object.entries(desc.entities)) {
    if (entity.map && !snapshot.envelopes[entityId]) {
      throw new Error(
        `descriptor '${entityId}' has map metadata but snapshot envelope '${entityId}' is missing`,
      );
    }
  }
}

export const emitSqlite: Stage<EmitSqliteInputs, EmitSqliteOutput> = {
  id: "emit-sqlite",
  inputs: ["load-descriptors", "load-snapshot", "emit-assets", "validate"],
  run: (inputs, ctx) => {
    assertSnapshotValidationPassed(inputs.validate);
    const outputPath = `${ctx.outDir}/data.sqlite`;
    mkdirSync(dirname(outputPath), { recursive: true });
    const tempPath = `${outputPath}.tmp-${process.pid}-${Date.now()}`;
    rmSync(tempPath, { force: true });
    let db: Database | undefined;
    try {
      db = new Database(tempPath, { create: true, readwrite: true });
      db.exec("PRAGMA journal_mode = DELETE;");
      db.exec("PRAGMA foreign_keys = ON;");
      db.exec(SITE_METADATA_DDL);
      const desc = inputs["load-descriptors"];
      const snapshot = inputs["load-snapshot"];
      validateDescriptorCoverage(desc);
      validateMappedSnapshotEnvelopes(desc, snapshot);
      const requiredEntry = Object.entries(entityRegistry).find(
        ([, module]) => module.requiredSnapshot,
      );
      if (
        !requiredEntry ||
        !desc.entities[requiredEntry[0]] ||
        !snapshot.envelopes[requiredEntry[0]] ||
        (requiredEntry[1].requiredSnapshot?.variants && !desc.variants[requiredEntry[0]])
      ) {
        throw new Error(
          requiredEntry?.[1].requiredSnapshot?.error ??
            "emit-sqlite: missing required entity descriptor or envelope",
        );
      }
      for (const [entityId, module] of Object.entries(entityRegistry)) {
        const entity = desc.entities[entityId];
        const envelope = snapshot.envelopes[entityId];
        if (!entity || !envelope) continue;
        const variants = desc.variants[entityId] ?? [];
        db.exec(typeof module.ddl === "function" ? module.ddl(entity, variants) : module.ddl);
        assertCanonicalTableContract(db, entity);
        module.canonicalise({ db, entity, variants, envelope });
      }
      emitSiteMetadata(db, desc);
      const assetRefInsert = db.prepare(
        `INSERT INTO asset_refs (entity_id, entity_row_id, slot, asset_kind, asset_hash) VALUES (?, ?, ?, ?, ?)`,
      );
      for (const ref of inputs["emit-assets"]?.refs ?? []) {
        assetRefInsert.run(ref.entityId, ref.entityRowId, ref.slot, ref.assetKind, ref.assetHash);
      }
      emitReadModels(db, desc, inputs["load-snapshot"], inputs["emit-assets"]);
      db.exec(`CREATE TABLE artifact_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
      const metadataInsert = db.prepare("INSERT INTO artifact_metadata (key, value) VALUES (?, ?)");
      metadataInsert.run("schemaVersion", "1");
      db.close();
      db = undefined;
      publishValidatedSqlite(tempPath, outputPath);
      return { outputPath, byteSize: Bun.file(outputPath).size };
    } catch (error) {
      db?.close();
      rmSync(tempPath, { force: true });
      rmSync(`${tempPath}-wal`, { force: true });
      rmSync(`${tempPath}-shm`, { force: true });
      throw error;
    }
  },
};
