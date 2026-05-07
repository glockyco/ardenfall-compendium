import { query, queryOne } from "./index.js";

export interface ItemOverviewRow {
  id: string;
  name: string | null;
  weight: number | null;
  value: number | null;
  variant: string | null;
}

export interface ItemDetailRow {
  id: string;
  name: string | null;
  variant: string | null;
  fields_json: string;
}

export const listItemsOverview = () =>
  query<ItemOverviewRow>("SELECT * FROM item_overview_rows ORDER BY name");

export const getItemDetail = (id: string) =>
  queryOne<ItemDetailRow>("SELECT * FROM item_detail_rows WHERE id = ?", [id]);
