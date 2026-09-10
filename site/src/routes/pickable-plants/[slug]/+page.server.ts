import { error } from "@sveltejs/kit";
import {
  getPlacedPlantPresentation,
  listPlacedPlants,
  listRelationshipSections,
} from "$lib/server/read-models";
import type { EntryGenerator, PageServerLoad } from "./$types";

const slugFromRoutePath = (routePath: string) => routePath.slice(routePath.lastIndexOf("/") + 1);
export const prerender = true;

export const entries: EntryGenerator = () =>
  listPlacedPlants().map((row) => ({ slug: slugFromRoutePath(row.routePath) }));

export const load: PageServerLoad = ({ params }) => {
  const presentation = getPlacedPlantPresentation(params.slug);
  if (!presentation) throw error(404, "Pickable plant not found");
  return {
    presentation,
    relationships: listRelationshipSections("placed-plant", presentation.id),
  };
};
