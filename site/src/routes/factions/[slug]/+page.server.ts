import { error } from "@sveltejs/kit";
import {
  getFactionPresentation,
  listFactions,
  listRelationshipSections,
} from "$lib/server/read-models";
import type { EntryGenerator, PageServerLoad } from "./$types";

const slugFromRoutePath = (routePath: string) => routePath.slice(routePath.lastIndexOf("/") + 1);
export const prerender = true;

export const entries: EntryGenerator = () =>
  listFactions().map((row) => ({ slug: slugFromRoutePath(row.routePath) }));

export const load: PageServerLoad = ({ params }) => {
  const presentation = getFactionPresentation(params.slug);
  if (!presentation) throw error(404, "Faction not found");
  return {
    presentation,
    relationships: listRelationshipSections("faction", presentation.id),
  };
};
