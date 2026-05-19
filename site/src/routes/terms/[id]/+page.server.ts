import { error } from "@sveltejs/kit";
import { getTerm, listTermIds } from "$lib/server/read-models";
import type { EntryGenerator, PageServerLoad } from "./$types";

export const prerender = true;

export const entries: EntryGenerator = () => listTermIds().map((id) => ({ id }));

export const load: PageServerLoad = ({ params }) => {
  const term = getTerm(params.id);
  if (!term) throw error(404, "Term not found");
  return { term };
};
