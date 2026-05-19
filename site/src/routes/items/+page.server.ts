import {
  getEntity,
  getEntityField,
  listItemsOverview,
  listItemOverviewCategories,
  listItemOverviewFilters,
  listOverviewColumns,
  type ItemOverviewRow,
} from "$lib/server/read-models";
import type { PageServerLoad } from "./$types";

export const prerender = true;

export const load: PageServerLoad = () => {
  const entity = getEntity("item");
  const columnsMeta = listOverviewColumns("item");
  const rows = listItemsOverview();

  const columns = columnsMeta.map((c) => {
    const field = getEntityField("item", c.field_id);
    return {
      id: c.column_id,
      label: field?.label ?? c.field_id,
      field: c.field_id as keyof ItemOverviewRow & string,
      renderer: c.renderer,
      sortable: c.sortable !== 0,
    };
  });

  return {
    label: entity?.plural_label ?? "Items",
    columns,
    rows,
    categories: listItemOverviewCategories(),
    filters: listItemOverviewFilters(),
  };
};
