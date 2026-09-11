import { error } from "@sveltejs/kit";
import {
  getPlacedItemPresentation,
  listPlacedItems,
  listRelationshipSections,
} from "$lib/server/read-models";
import type { EntryGenerator, PageServerLoad } from "./$types";

const slugFromRoutePath = (routePath: string) => routePath.slice(routePath.lastIndexOf("/") + 1);
export const prerender = true;

export const entries: EntryGenerator = () =>
  listPlacedItems().map((row) => ({ slug: slugFromRoutePath(row.routePath) }));

export const load: PageServerLoad = ({ params }) => {
  const presentation = getPlacedItemPresentation(params.slug);
  if (!presentation) throw error(404, "Placed item not found");
  return {
    presentation,
    relationships: listRelationshipSections("placed-item", presentation.id),
  };
};
