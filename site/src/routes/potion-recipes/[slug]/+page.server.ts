import { error } from "@sveltejs/kit";
import {
  getPotionRecipePresentation,
  listPotionRecipes,
  listRelationshipSections,
} from "$lib/server/read-models";
import type { EntryGenerator, PageServerLoad } from "./$types";

const slugFromRoutePath = (routePath: string) => routePath.slice(routePath.lastIndexOf("/") + 1);
export const prerender = true;

export const entries: EntryGenerator = () =>
  listPotionRecipes().map((row) => ({ slug: slugFromRoutePath(row.routePath) }));

export const load: PageServerLoad = ({ params }) => {
  const presentation = getPotionRecipePresentation(params.slug);
  if (!presentation) throw error(404, "Potion recipe not found");
  return {
    presentation,
    relationships: listRelationshipSections("potion-recipe", presentation.id),
  };
};
