import type { Database } from "bun:sqlite";
import type { LoadDescriptorsOutput } from "./load-descriptors.ts";
import type { SnapshotItemIconMetadata } from "../types.ts";

export const ITEM_READ_MODEL_DDL = `
CREATE TABLE item_overview_rows (
  id                  TEXT NOT NULL PRIMARY KEY,
  name                TEXT,
  weight              REAL,
  value               INTEGER,
  variant             TEXT,
  display_icon_hash   TEXT,
  display_icon_color  TEXT
);
CREATE TABLE item_detail_rows (
  id                  TEXT NOT NULL PRIMARY KEY,
  name                TEXT,
  variant             TEXT,
  display_icon_hash   TEXT,
  display_icon_color  TEXT,
  fields_json         TEXT NOT NULL
);
`;

type DescriptorField = { name: string; type: string };

export function emitItemReadModels(
  db: Database,
  desc: LoadDescriptorsOutput,
  itemIconMetadata: SnapshotItemIconMetadata[] = [],
): void {
  db.exec(ITEM_READ_MODEL_DDL);
  const colorByItem = new Map(
    itemIconMetadata
      .filter((entry) => entry.entityId === "item")
      .map((entry) => [entry.rowId, JSON.stringify(entry.displayIconColor)]),
  );
  const overviewInsert = db.prepare(
    `INSERT INTO item_overview_rows (id, name, weight, value, variant, display_icon_hash, display_icon_color) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const overviewSource = db
    .query(
      `SELECT i.id, i.name, i.weight, i.value, i.variant, ar.asset_hash AS display_icon_hash
       FROM items i
       LEFT JOIN asset_refs ar
         ON ar.entity_id = 'item'
        AND ar.entity_row_id = i.id
        AND ar.slot = 'displayIcon'
        AND ar.asset_kind = 'image'`,
    )
    .all() as {
    id: string;
    name: string | null;
    weight: number | null;
    value: number | null;
    variant: string | null;
    display_icon_hash: string | null;
  }[];
  for (const row of overviewSource) {
    overviewInsert.run(
      row.id,
      row.name,
      row.weight,
      row.value,
      row.variant,
      row.display_icon_hash,
      colorByItem.get(row.id) ?? null,
    );
  }

  // Build a single-row JSON aggregate per item by concatenating fields from
  // ancestor variant tables. We do this with a per-row loop so SQLite stays
  // schema-agnostic and the test owns the contract.
  const variants = desc.variants.item ?? [];
  const rootFields = desc.entities.item?.fields ?? [];
  const items = db.query("SELECT id, name, variant FROM items").all() as {
    id: string;
    name: string;
    variant: string;
  }[];
  const insertDetail = db.prepare(
    `INSERT INTO item_detail_rows (id, name, variant, display_icon_hash, display_icon_color, fields_json) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const displayIconByItem = new Map<string, string | null>();
  for (const row of db
    .query(
      `SELECT entity_row_id, asset_hash FROM asset_refs WHERE entity_id = 'item' AND slot = 'displayIcon' AND asset_kind = 'image'`,
    )
    .all() as { entity_row_id: string; asset_hash: string }[]) {
    displayIconByItem.set(row.entity_row_id, row.asset_hash);
  }

  function ancestry(variantId: string) {
    const chain = [];
    let cur = variants.find((v) => v.variantId === variantId);
    while (cur) {
      chain.unshift(cur);
      cur = cur.parentVariantId
        ? variants.find((v) => v.variantId === cur!.parentVariantId)
        : undefined;
    }
    return chain;
  }

  function assignFields(
    target: Record<string, unknown>,
    row: Record<string, unknown>,
    descriptors: DescriptorField[],
  ): void {
    for (const [key, value] of Object.entries(row)) {
      const descriptor = descriptors.find((field) => field.name === key);
      if (
        typeof value === "string" &&
        descriptor &&
        (descriptor.type === "json" || descriptor.type.startsWith("ref:"))
      ) {
        target[key] = JSON.parse(value);
      } else {
        target[key] = value;
      }
    }
  }

  const tx = db.transaction(() => {
    for (const item of items) {
      const fields: Record<string, unknown> = {};
      const root = db.query("SELECT * FROM items WHERE id = ?").get(item.id) as Record<
        string,
        unknown
      >;
      assignFields(fields, root, rootFields);
      for (const variant of ancestry(item.variant)) {
        const layer = db
          .query(`SELECT * FROM "${variant.canonicalTable}" WHERE id = ?`)
          .get(item.id) as Record<string, unknown> | undefined;
        if (layer) assignFields(fields, layer, variant.fields);
      }
      insertDetail.run(
        item.id,
        item.name,
        item.variant,
        displayIconByItem.get(item.id) ?? null,
        colorByItem.get(item.id) ?? null,
        JSON.stringify(fields),
      );
    }
  });
  tx();
}
