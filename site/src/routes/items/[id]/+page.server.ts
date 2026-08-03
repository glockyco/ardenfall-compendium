import { error } from "@sveltejs/kit";
import {
  getItemPresentation,
  listItemIds,
  listRelationshipSections,
} from "$lib/server/read-models";
import type { EntryGenerator, PageServerLoad } from "./$types";

export const prerender = true;

export const entries: EntryGenerator = () => listItemIds().map((id) => ({ id }));

export const load: PageServerLoad = ({ params }) => {
  const presentation = getItemPresentation(params.id);
  if (!presentation) throw error(404, "Item not found");

  const relationships = listRelationshipSections("item", presentation.id);

  return {
    presentation,
    relationships,
  };
};
