import { error } from "@sveltejs/kit";
import { getStatTypePresentation, listStatTypes } from "$lib/server/read-models";
import type { EntryGenerator, PageServerLoad } from "./$types";

export const prerender = true;

export const entries: EntryGenerator = () =>
  listStatTypes().map((row) => ({ slug: row.routePath.replace("/stats/", "") }));

export const load: PageServerLoad = ({ params }) => {
  const presentation = getStatTypePresentation(params.slug);
  if (!presentation) throw error(404, "Stat not found");
  return { presentation };
};
