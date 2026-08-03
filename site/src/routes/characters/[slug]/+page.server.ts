import { error } from "@sveltejs/kit";
import {
  getCharacterPresentation,
  listCharacters,
  listRelationshipSections,
} from "$lib/server/read-models";
import type { EntryGenerator, PageServerLoad } from "./$types";

const slugFromRoutePath = (routePath: string) => routePath.slice(routePath.lastIndexOf("/") + 1);
export const prerender = true;

export const entries: EntryGenerator = () =>
  listCharacters().map((row) => ({ slug: slugFromRoutePath(row.routePath) }));

export const load: PageServerLoad = ({ params }) => {
  const presentation = getCharacterPresentation(params.slug);
  if (!presentation) throw error(404, "Character not found");
  return {
    presentation,
    relationships: listRelationshipSections("character", presentation.id),
  };
};
