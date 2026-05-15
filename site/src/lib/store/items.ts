import { query, queryOne } from "./index.js";

const assetSrc = (hash: string | null): string | null => (hash ? `/assets/${hash}.webp` : null);

interface ItemOverviewRecord {
  id: string;
  name: string | null;
  weight: number | null;
  value: number | null;
  variant: string | null;
  display_icon_hash: string | null;
  display_icon_color: string | null;
}

interface ItemDetailRecord {
  id: string;
  name: string | null;
  variant: string | null;
  display_icon_hash: string | null;
  display_icon_color: string | null;
  fields_json: string;
}

export interface ItemOverviewRow {
  id: string;
  name: string | null;
  weight: number | null;
  value: number | null;
  variant: string | null;
  displayIconSrc: string | null;
  displayIconColor: string | null;
}

export interface ItemDetailRow {
  id: string;
  name: string | null;
  variant: string | null;
  displayIconSrc: string | null;
  displayIconColor: string | null;
  fields_json: string;
}

export const listItemsOverview = async (): Promise<ItemOverviewRow[]> => {
  const rows = await query<ItemOverviewRecord>("SELECT * FROM item_overview_rows ORDER BY name");
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    weight: row.weight,
    value: row.value,
    variant: row.variant,
    displayIconSrc: assetSrc(row.display_icon_hash),
    displayIconColor: row.display_icon_color,
  }));
};

export const getItemDetail = async (id: string): Promise<ItemDetailRow | undefined> => {
  const row = await queryOne<ItemDetailRecord>("SELECT * FROM item_detail_rows WHERE id = ?", [id]);
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    variant: row.variant,
    displayIconSrc: assetSrc(row.display_icon_hash),
    displayIconColor: row.display_icon_color,
    fields_json: row.fields_json,
  };
};
