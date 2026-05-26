import { Database } from "bun:sqlite";
import { mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import type { Stage } from "../types.ts";
import { buildDDL } from "../sql/ddl";
import { SITE_METADATA_DDL } from "../sql/site-metadata-ddl";
import { canonicaliseItems } from "../entities/item/canonicaliser";
import { canonicaliseStatTypes } from "../entities/stat-type/canonicaliser";
import { canonicaliseItemCategories } from "../entities/item-category/canonicaliser";
import { canonicaliseItemTags } from "../entities/item-tag/canonicaliser";
import { STAT_TYPE_DDL } from "../sql/stat-type-ddl";
import { ITEM_CATEGORY_DDL } from "../sql/item-category-ddl";
import { ITEM_TAG_DDL } from "../sql/item-tag-ddl";
import { emitSiteMetadata } from "./emit-site-metadata";
import { emitReadModels } from "./emit-read-models";
import { validateDescriptorCoverage } from "../entities/registry";
import { validateDeployableSqlite } from "../artifacts/sqlite-validation";
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
      validateDescriptorCoverage(desc);
      const itemEntity = desc.entities.item;
      const itemVariants = desc.variants.item;
      const itemEnvelope = inputs["load-snapshot"].envelopes.item;
      if (!itemEntity || !itemVariants || !itemEnvelope) {
        throw new Error("emit-sqlite: missing item descriptor or envelope");
      }
      db.exec(buildDDL(itemEntity, itemVariants));
      canonicaliseItems(db, itemEntity, itemVariants, itemEnvelope);
      const statTypeEnvelope = inputs["load-snapshot"].envelopes["stat-type"];
      if (statTypeEnvelope) {
        db.exec(STAT_TYPE_DDL);
        canonicaliseStatTypes(db, statTypeEnvelope);
      }
      const itemCategoryEnvelope = inputs["load-snapshot"].envelopes["item-category"];
      if (itemCategoryEnvelope) {
        db.exec(ITEM_CATEGORY_DDL);
        canonicaliseItemCategories(db, itemCategoryEnvelope);
      }
      const itemTagEnvelope = inputs["load-snapshot"].envelopes["item-tag"];
      if (itemTagEnvelope) {
        db.exec(ITEM_TAG_DDL);
        canonicaliseItemTags(db, itemTagEnvelope);
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
      renameSync(tempPath, outputPath);
      validateDeployableSqlite(outputPath);
      return { outputPath, byteSize: Bun.file(outputPath).size };
    } catch (error) {
      db?.close();
      rmSync(tempPath, { force: true });
      throw error;
    }
  },
};
