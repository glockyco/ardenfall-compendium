import { error } from "@sveltejs/kit";
import {
  getDialoguePresentation,
  listDialogues,
  listRelationshipSections,
} from "$lib/server/read-models";
import type { EntryGenerator, PageServerLoad } from "./$types";

const slugFromRoutePath = (routePath: string) => routePath.slice(routePath.lastIndexOf("/") + 1);
export const prerender = true;

export const entries: EntryGenerator = () =>
  listDialogues().map((row) => ({ slug: slugFromRoutePath(row.routePath) }));

export const load: PageServerLoad = ({ params }) => {
  const presentation = getDialoguePresentation(params.slug);
  if (!presentation) throw error(404, "Conversation not found");
  return {
    presentation,
    relationships: listRelationshipSections("dialogue", presentation.id),
  };
};
