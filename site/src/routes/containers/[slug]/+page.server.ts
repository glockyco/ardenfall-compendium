import { error } from "@sveltejs/kit";
import {
  getContainerPresentation,
  listContainers,
  listRelationshipSections,
} from "$lib/server/read-models";
import type { EntryGenerator, PageServerLoad } from "./$types";

const slugFromRoutePath = (routePath: string) => routePath.slice(routePath.lastIndexOf("/") + 1);
export const prerender = true;

export const entries: EntryGenerator = () =>
  listContainers().map((row) => ({ slug: slugFromRoutePath(row.routePath) }));

export const load: PageServerLoad = ({ params }) => {
  const presentation = getContainerPresentation(params.slug);
  if (!presentation) throw error(404, "Container not found");
  return {
    presentation,
    relationships: listRelationshipSections("placed-container", presentation.id),
  };
};
