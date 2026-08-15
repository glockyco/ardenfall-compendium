import { error } from "@sveltejs/kit";
import {
  getCharacterTypePresentation,
  listCharacterTypes,
  listRelationshipSections,
} from "$lib/server/read-models";
import type { EntryGenerator, PageServerLoad } from "./$types";

const slugFromRoutePath = (routePath: string) => routePath.slice(routePath.lastIndexOf("/") + 1);
export const prerender = true;

export const entries: EntryGenerator = () =>
  listCharacterTypes().map((row) => ({ slug: slugFromRoutePath(row.routePath) }));

export const load: PageServerLoad = ({ params }) => {
  const presentation = getCharacterTypePresentation(params.slug);
  if (!presentation) throw error(404, "Character type not found");
  return {
    presentation,
    relationships: listRelationshipSections("character", presentation.id),
  };
};
