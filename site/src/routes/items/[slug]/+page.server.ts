import { error } from "@sveltejs/kit";
import {
  getItemPresentation,
  listItemSlugs,
  listRelationshipSections,
} from "$lib/server/read-models";
import type { EntryGenerator, PageServerLoad } from "./$types";

export const prerender = true;

export const entries: EntryGenerator = () => listItemSlugs().map((slug) => ({ slug }));

export const load: PageServerLoad = ({ params }) => {
  const presentation = getItemPresentation(params.slug);
  if (!presentation) throw error(404, "Item not found");

  const relationships = listRelationshipSections("item", presentation.id);

  return {
    presentation,
    relationships,
  };
};
