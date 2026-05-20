import { error } from "@sveltejs/kit";
import {
  getItemCategoryPresentation,
  listItemCategories,
  listItemsByCategory,
} from "$lib/server/read-models";
import type { EntryGenerator, PageServerLoad } from "./$types";

export const prerender = true;

export const entries: EntryGenerator = () =>
  listItemCategories().map((row) => ({ slug: row.routePath.replace("/categories/", "") }));

export const load: PageServerLoad = ({ params }) => {
  const presentation = getItemCategoryPresentation(params.slug);
  if (!presentation) throw error(404, "Category not found");
  return {
    presentation,
    items: listItemsByCategory(presentation.id),
  };
};
