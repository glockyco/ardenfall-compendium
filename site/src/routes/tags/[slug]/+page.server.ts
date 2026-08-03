import { error } from "@sveltejs/kit";
import {
  getEntityField,
  getItemTagPresentation,
  listItemTags,
  listItemsByTag,
  listOverviewColumns,
  listRelationshipSections,
  type ItemOverviewRow,
} from "$lib/server/read-models";
import type { EntryGenerator, PageServerLoad } from "./$types";

const slugFromRoutePath = (routePath: string) => routePath.slice(routePath.lastIndexOf("/") + 1);
export const prerender = true;

export const entries: EntryGenerator = () =>
  listItemTags().map((row) => ({ slug: slugFromRoutePath(row.routePath) }));

export const load: PageServerLoad = ({ params }) => {
  const presentation = getItemTagPresentation(params.slug);
  if (!presentation) throw error(404, "Tag not found");
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
    presentation,
    columns,
    items: listItemsByTag(presentation.id),
    relationships: listRelationshipSections("item-tag", presentation.id),
  };
};
