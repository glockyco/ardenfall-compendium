import { error } from "@sveltejs/kit";
import {
  getSceneDialoguePresentation,
  listRelationshipSections,
  listSceneDialogue,
} from "$lib/server/read-models";
import type { EntryGenerator, PageServerLoad } from "./$types";

const slugFromRoutePath = (routePath: string) => routePath.slice(routePath.lastIndexOf("/") + 1);
export const prerender = true;

export const entries: EntryGenerator = () =>
  listSceneDialogue().map((row) => ({ slug: slugFromRoutePath(row.routePath) }));

export const load: PageServerLoad = ({ params }) => {
  const presentation = getSceneDialoguePresentation(params.slug);
  if (!presentation) throw error(404, "Scene dialogue not found");
  return {
    presentation,
    relationships: listRelationshipSections("scene-dialogue", presentation.id),
  };
};
