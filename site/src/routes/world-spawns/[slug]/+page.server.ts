import { error } from "@sveltejs/kit";
import {
  getWorldSpawnPresentation,
  listRelationshipSections,
  listWorldSpawns,
} from "$lib/server/read-models";
import type { EntryGenerator, PageServerLoad } from "./$types";

const slugFromRoutePath = (routePath: string) => routePath.slice(routePath.lastIndexOf("/") + 1);
export const prerender = true;

export const entries: EntryGenerator = () =>
  listWorldSpawns().map((row) => ({ slug: slugFromRoutePath(row.routePath) }));

export const load: PageServerLoad = ({ params }) => {
  const presentation = getWorldSpawnPresentation(params.slug);
  if (!presentation) throw error(404, "World spawn not found");
  return {
    presentation,
    relationships: listRelationshipSections("world-spawn", presentation.id),
  };
};
