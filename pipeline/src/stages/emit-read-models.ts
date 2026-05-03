import type { Database } from "bun:sqlite";
import type { LoadDescriptorsOutput } from "./load-descriptors.ts";

export const ITEM_READ_MODEL_DDL = `
CREATE TABLE item_overview_rows (
  id       TEXT NOT NULL PRIMARY KEY,
  name     TEXT,
  weight   REAL,
  value    INTEGER,
  variant  TEXT
);
CREATE TABLE item_detail_rows (
  id           TEXT NOT NULL PRIMARY KEY,
  name         TEXT,
  variant      TEXT,
  fields_json  TEXT NOT NULL
);
`;

export function emitItemReadModels(db: Database, desc: LoadDescriptorsOutput): void {
  db.exec(ITEM_READ_MODEL_DDL);
  db.run(
    `INSERT INTO item_overview_rows (id, name, weight, value, variant)
     SELECT id, name, weight, value, variant FROM items`,
  );

  // Build a single-row JSON aggregate per item by concatenating fields from
  // ancestor variant tables. We do this with a per-row loop so SQLite stays
  // schema-agnostic and the test owns the contract.
  const variants = desc.variants.item ?? [];
  const items = db.query("SELECT id, name, variant FROM items").all() as {
    id: string;
    name: string;
    variant: string;
  }[];
  const insertDetail = db.prepare(
    `INSERT INTO item_detail_rows (id, name, variant, fields_json) VALUES (?, ?, ?, ?)`,
  );

  function ancestry(variantId: string): string[] {
    const chain: string[] = [];
    let cur = variants.find((v) => v.variantId === variantId);
    while (cur) {
      chain.unshift(cur.canonicalTable);
      cur = cur.parentVariantId
        ? variants.find((v) => v.variantId === cur!.parentVariantId)
        : undefined;
    }
    return chain;
  }

  const tx = db.transaction(() => {
    for (const item of items) {
      const fields: Record<string, unknown> = {};
      const root = db.query("SELECT * FROM items WHERE id = ?").get(item.id) as Record<
        string,
        unknown
      >;
      Object.assign(fields, root);
      for (const tableName of ancestry(item.variant)) {
        const layer = db.query(`SELECT * FROM "${tableName}" WHERE id = ?`).get(item.id) as
          | Record<string, unknown>
          | undefined;
        if (layer) Object.assign(fields, layer);
      }
      insertDetail.run(item.id, item.name, item.variant, JSON.stringify(fields));
    }
  });
  tx();
}
