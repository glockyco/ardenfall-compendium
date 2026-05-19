import type { Database } from "bun:sqlite";
import type { LoadDescriptorsOutput } from "./load-descriptors.ts";
import type {
  MasterTooltipDictionary,
  SnapshotEnvelope,
  SnapshotItemIconMetadata,
} from "../types.ts";
import { translateRichTextV1 } from "../rich-text/rich-text-v1.ts";

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
CREATE TABLE item_presentation_rows (
  id                          TEXT NOT NULL PRIMARY KEY,
  name                        TEXT,
  variant                     TEXT,
  item_type                   TEXT,
  render_context              TEXT NOT NULL,
  display_icon_hash           TEXT,
  display_icon_color          TEXT,
  description_source          TEXT NOT NULL,
  description_rich_text_json  TEXT NOT NULL,
  effects_source              TEXT NOT NULL,
  effect_facts_json           TEXT NOT NULL,
  stat_rows_json              TEXT NOT NULL,
  requirements_json           TEXT NOT NULL,
  durability_json             TEXT,
  state_facts_json            TEXT NOT NULL,
  omissions_json              TEXT NOT NULL,
  value                       INTEGER,
  weight                      REAL,
  diagnostics_json            TEXT NOT NULL
);
`;

export function emitItemReadModels(
  db: Database,
  _desc: LoadDescriptorsOutput,
  itemIconMetadata: SnapshotItemIconMetadata[] = [],
  itemEnvelope?: SnapshotEnvelope,
  masterTooltip?: MasterTooltipDictionary,
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

  if (!itemEnvelope) {
    throw new Error("emitItemReadModels: missing item envelope for item presentation rows");
  }
  const displayIconByItem = new Map<string, string | null>();
  for (const row of db
    .query(
      `SELECT entity_row_id, asset_hash FROM asset_refs WHERE entity_id = 'item' AND slot = 'displayIcon' AND asset_kind = 'image'`,
    )
    .all() as { entity_row_id: string; asset_hash: string }[]) {
    displayIconByItem.set(row.entity_row_id, row.asset_hash);
  }
  const itemById = new Map(
    (
      db.query("SELECT id, name, variant FROM items").all() as {
        id: string;
        name: string;
        variant: string;
      }[]
    ).map((row) => [row.id, row] as const),
  );
  const presentationInsert = db.prepare(
    `INSERT INTO item_presentation_rows (
      id, name, variant, item_type, render_context, display_icon_hash, display_icon_color,
      description_source, description_rich_text_json, effects_source, effect_facts_json,
      stat_rows_json, requirements_json, durability_json, state_facts_json, omissions_json,
      value, weight, diagnostics_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const tx = db.transaction(() => {
    for (const snapshotRow of itemEnvelope.rows) {
      const presentation = snapshotRow.presentation;
      if (!presentation) continue;
      const item = itemById.get(snapshotRow.id);
      const description = translateRichTextV1(presentation.descriptionSource, {
        tooltipCodes: masterTooltip?.tooltipCodes,
        tooltipColors: masterTooltip?.tooltipColors,
      });
      presentationInsert.run(
        snapshotRow.id,
        item?.name ?? presentation.displayName,
        item?.variant ?? snapshotRow.variant,
        presentation.itemType,
        presentation.renderContext,
        displayIconByItem.get(snapshotRow.id) ?? null,
        colorByItem.get(snapshotRow.id) ?? null,
        presentation.descriptionSource,
        JSON.stringify(description),
        presentation.effectsSource,
        JSON.stringify(presentation.effects),
        JSON.stringify(presentation.statRows),
        JSON.stringify(presentation.requirements),
        presentation.durability ? JSON.stringify(presentation.durability) : null,
        JSON.stringify(presentation.stateFacts),
        JSON.stringify(presentation.omissions),
        presentation.value,
        presentation.weight,
        JSON.stringify([...presentation.diagnostics, ...description.diagnostics]),
      );
    }
  });
  tx();
}
