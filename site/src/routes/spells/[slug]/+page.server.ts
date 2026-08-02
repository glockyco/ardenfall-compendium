import { error } from "@sveltejs/kit";
import { getSpellPresentation, listItemsCarryingSpell, listSpells } from "$lib/server/read-models";
import type { EntryGenerator, PageServerLoad } from "./$types";

const slugFromRoutePath = (routePath: string) => routePath.slice(routePath.lastIndexOf("/") + 1);
export const prerender = true;

export const entries: EntryGenerator = () =>
  listSpells().map((row) => ({ slug: slugFromRoutePath(row.routePath) }));

export const load: PageServerLoad = ({ params }) => {
  const presentation = getSpellPresentation(params.slug);
  if (!presentation) throw error(404, "Spell not found");
  return {
    presentation,
    relationships: [
      {
        id: "items-casting-spell",
        title: "Carried by items",
        predicate: "casts",
        edges: listItemsCarryingSpell(presentation.id),
      },
    ],
  };
};
