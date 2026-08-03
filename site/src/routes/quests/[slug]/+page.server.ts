import { error } from "@sveltejs/kit";
import {
  getQuestPresentation,
  listQuests,
  listRelationshipSections,
} from "$lib/server/read-models";
import type { EntryGenerator, PageServerLoad } from "./$types";

const slugFromRoutePath = (routePath: string) => routePath.slice(routePath.lastIndexOf("/") + 1);

export const prerender = true;

export const entries: EntryGenerator = () =>
  listQuests().map((row) => ({ slug: slugFromRoutePath(row.routePath) }));

export const load: PageServerLoad = ({ params }) => {
  const presentation = getQuestPresentation(params.slug);
  if (!presentation) throw error(404, "Quest not found");
  return {
    presentation,
    relationships: listRelationshipSections("quest", presentation.id),
  };
};
