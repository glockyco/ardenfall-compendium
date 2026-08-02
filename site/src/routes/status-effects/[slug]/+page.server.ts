import { error } from "@sveltejs/kit";
import { getStatusEffectPresentation, listStatusEffects } from "$lib/server/read-models";
import type { EntryGenerator, PageServerLoad } from "./$types";

const slugFromRoutePath = (routePath: string) => routePath.slice(routePath.lastIndexOf("/") + 1);
export const prerender = true;

export const entries: EntryGenerator = () =>
  listStatusEffects().map((row) => ({ slug: slugFromRoutePath(row.routePath) }));

export const load: PageServerLoad = ({ params }) => {
  const presentation = getStatusEffectPresentation(params.slug);
  if (!presentation) throw error(404, "Status effect not found");
  return { presentation };
};
