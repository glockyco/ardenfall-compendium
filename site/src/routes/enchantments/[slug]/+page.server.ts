import { error } from "@sveltejs/kit";
import {
  getEnchantmentPresentation,
  listEnchantments,
  listRelationshipSections,
} from "$lib/server/read-models";
import type { EntryGenerator, PageServerLoad } from "./$types";

const slugFromRoutePath = (routePath: string) => routePath.slice(routePath.lastIndexOf("/") + 1);
export const prerender = true;

export const entries: EntryGenerator = () =>
  listEnchantments().map((row) => ({ slug: slugFromRoutePath(row.routePath) }));

export const load: PageServerLoad = ({ params }) => {
  const presentation = getEnchantmentPresentation(params.slug);
  if (!presentation) throw error(404, "Enchantment not found");
  return {
    presentation,
    relationships: listRelationshipSections("enchantment", presentation.id),
  };
};
