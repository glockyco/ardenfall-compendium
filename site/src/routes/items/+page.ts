import { getEntity, getEntityField, listOverviewColumns } from "$lib/store/site-meta.js";
import { listItemsOverview, type ItemOverviewRow } from "$lib/store/items.js";

export const load = async () => {
  const [entity, columnsMeta, rows] = await Promise.all([
    getEntity("item"),
    listOverviewColumns("item"),
    listItemsOverview(),
  ]);

  const columns = await Promise.all(
    columnsMeta.map(async (c) => {
      const field = await getEntityField("item", c.field_id);
      return {
        id: c.column_id,
        label: field?.label ?? c.field_id,
        field: c.field_id as keyof ItemOverviewRow & string,
      };
    }),
  );

  return {
    label: entity?.plural_label ?? "Items",
    columns,
    rows,
  };
};
