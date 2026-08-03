import { error } from "@sveltejs/kit";
import {
  getLocationPresentation,
  listLocations,
  listRelationshipSections,
} from "$lib/server/read-models";
import type { EntryGenerator, PageServerLoad } from "./$types";

const slugFromRoutePath = (routePath: string) => routePath.slice(routePath.lastIndexOf("/") + 1);
export const prerender = true;

export const entries: EntryGenerator = () =>
  listLocations().map((row) => ({ slug: slugFromRoutePath(row.routePath) }));

export const load: PageServerLoad = ({ params }) => {
  const presentation = getLocationPresentation(params.slug);
  if (!presentation) throw error(404, "Location not found");
  return {
    presentation,
    relationships: listRelationshipSections("location", presentation.id),
  };
};
