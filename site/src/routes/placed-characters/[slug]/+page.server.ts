import { error } from "@sveltejs/kit";
import {
  getPlacedCharacterPresentation,
  listPlacedCharacters,
  listRelationshipSections,
} from "$lib/server/read-models";
import type { EntryGenerator, PageServerLoad } from "./$types";

const slugFromRoutePath = (routePath: string) => routePath.slice(routePath.lastIndexOf("/") + 1);
export const prerender = true;

export const entries: EntryGenerator = () =>
  listPlacedCharacters().map((row) => ({ slug: slugFromRoutePath(row.routePath) }));

export const load: PageServerLoad = ({ params }) => {
  const presentation = getPlacedCharacterPresentation(params.slug);
  if (!presentation) throw error(404, "Placed character not found");
  return {
    presentation,
    relationships: listRelationshipSections("npc", presentation.id),
  };
};
