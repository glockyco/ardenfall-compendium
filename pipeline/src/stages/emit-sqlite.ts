import { Database } from "bun:sqlite";
import { mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import type { Stage } from "../types.ts";
import { buildDDL } from "../sql/ddl";
import { SITE_METADATA_DDL } from "../sql/site-metadata-ddl";
import { canonicaliseItems } from "../entities/item/canonicaliser";
import { emitSiteMetadata } from "./emit-site-metadata";
import { emitItemReadModels } from "./emit-read-models";
import type { LoadDescriptorsOutput } from "./load-descriptors.ts";
import type { LoadSnapshotOutput } from "./load-snapshot.ts";
import type { EmitAssetsOutput } from "./emit-assets.ts";

export interface EmitSqliteInputs {
  "load-descriptors": LoadDescriptorsOutput;
  "load-snapshot": LoadSnapshotOutput;
  "emit-assets"?: EmitAssetsOutput;
}

export interface EmitSqliteOutput {
  outputPath: string;
  byteSize: number;
}

export const emitSqlite: Stage<EmitSqliteInputs, EmitSqliteOutput> = {
  id: "emit-sqlite",
  inputs: ["load-descriptors", "load-snapshot", "emit-assets"],
  run: (inputs, ctx) => {
    const outputPath = `${ctx.outDir}/data.sqlite`;
    mkdirSync(dirname(outputPath), { recursive: true });
    const tempPath = `${outputPath}.tmp-${process.pid}-${Date.now()}`;
    rmSync(tempPath, { force: true });
    let db: Database | undefined;
    try {
      db = new Database(tempPath, { create: true, readwrite: true });
      db.exec("PRAGMA journal_mode = DELETE;");
      db.exec(SITE_METADATA_DDL);
      const desc = inputs["load-descriptors"];
      const itemEntity = desc.entities.item;
      const itemVariants = desc.variants.item;
      const itemEnvelope = inputs["load-snapshot"].envelopes.item;
      if (!itemEntity || !itemVariants || !itemEnvelope) {
        throw new Error("emit-sqlite: missing item descriptor or envelope");
      }
      db.exec(buildDDL(itemEntity, itemVariants));
      canonicaliseItems(db, itemEntity, itemVariants, itemEnvelope);
      emitSiteMetadata(db, desc);
      emitItemReadModels(db, desc);
      const assetRefInsert = db.prepare(
        `INSERT INTO asset_refs (entity_id, entity_row_id, slot, asset_kind, asset_hash) VALUES (?, ?, ?, ?, ?)`,
      );
      for (const ref of inputs["emit-assets"]?.refs ?? []) {
        assetRefInsert.run(ref.entityId, ref.entityRowId, ref.slot, ref.assetKind, ref.assetHash);
      }
      db.close();
      db = undefined;
      renameSync(tempPath, outputPath);
      return { outputPath, byteSize: Bun.file(outputPath).size };
    } catch (error) {
      db?.close();
      rmSync(tempPath, { force: true });
      throw error;
    }
  },
};
