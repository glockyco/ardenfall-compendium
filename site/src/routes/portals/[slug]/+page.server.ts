import { error } from "@sveltejs/kit";
import {
  getPortalPresentation,
  listPortals,
  listRelationshipSections,
} from "$lib/server/read-models";
import type { EntryGenerator, PageServerLoad } from "./$types";

const slugFromRoutePath = (routePath: string) => routePath.slice(routePath.lastIndexOf("/") + 1);
export const prerender = true;

export const entries: EntryGenerator = () =>
  listPortals().map((row) => ({ slug: slugFromRoutePath(row.routePath) }));

export const load: PageServerLoad = ({ params }) => {
  const presentation = getPortalPresentation(params.slug);
  if (!presentation) throw error(404, "Portal not found");
  return {
    presentation,
    relationships: listRelationshipSections("portal", presentation.id),
  };
};
