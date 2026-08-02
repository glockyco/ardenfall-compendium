import { error } from "@sveltejs/kit";
import {
  getEntityField,
  getItemCategoryPresentation,
  listItemCategories,
  listItemOverviewCategories,
  listItemsByCategory,
  listOverviewColumns,
  type ItemOverviewRow,
} from "$lib/server/read-models";
import type { EntryGenerator, PageServerLoad } from "./$types";

const slugFromRoutePath = (routePath: string) => routePath.slice(routePath.lastIndexOf("/") + 1);
export const prerender = true;

export const entries: EntryGenerator = () =>
  listItemCategories().map((row) => ({ slug: slugFromRoutePath(row.routePath) }));

export const load: PageServerLoad = ({ params }) => {
  const presentation = getItemCategoryPresentation(params.slug);
  if (!presentation) throw error(404, "Category not found");
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
  const variant = listItemOverviewCategories().find(
    (entry) => entry.label.trim().toLowerCase() === presentation.name.trim().toLowerCase(),
  );
  return {
    presentation,
    columns,
    variantRoutePath: variant?.href ?? null,
    items: listItemsByCategory(presentation.id),
  };
};
