import { error } from "@sveltejs/kit";
import { getItemTagPresentation, listItemsByTag, listItemTags } from "$lib/server/read-models";
import type { EntryGenerator, PageServerLoad } from "./$types";

export const prerender = true;

export const entries: EntryGenerator = () =>
  listItemTags().map((row) => ({ slug: row.routePath.replace("/tags/", "") }));

export const load: PageServerLoad = ({ params }) => {
  const presentation = getItemTagPresentation(params.slug);
  if (!presentation) throw error(404, "Tag not found");
  return {
    presentation,
    items: listItemsByTag(presentation.id),
  };
};
