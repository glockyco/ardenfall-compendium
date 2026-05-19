import { error } from "@sveltejs/kit";
import {
  getEntity,
  getEntityField,
  listItemOverviewCategories,
  listItemsByVariant,
  listOverviewColumns,
  type ItemOverviewRow,
} from "$lib/server/read-models";
import type { EntryGenerator, PageServerLoad } from "./$types";

export const prerender = true;

export const entries: EntryGenerator = () =>
  listItemOverviewCategories().map((category) => ({ variant: category.id }));

export const load: PageServerLoad = ({ params }) => {
  const category = listItemOverviewCategories().find((entry) => entry.id === params.variant);
  if (!category) throw error(404, "Item variant not found");

  const entity = getEntity("item");
  const columns = listOverviewColumns("item").map((column) => {
    const field = getEntityField("item", column.field_id);
    return {
      id: column.column_id,
      label: field?.label ?? column.field_id,
      field: column.field_id as keyof ItemOverviewRow & string,
      renderer: column.renderer,
      sortable: column.sortable !== 0,
    };
  });

  return {
    label: entity?.plural_label ?? "Items",
    category,
    columns,
    rows: listItemsByVariant(params.variant),
  };
};
