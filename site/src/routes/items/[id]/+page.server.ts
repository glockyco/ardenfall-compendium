import { error } from "@sveltejs/kit";
import {
  getItemPresentation,
  listCategoriesForItem,
  listItemIds,
  listRelationshipSections,
  listTagsForItem,
} from "$lib/server/read-models";
import type { EntryGenerator, PageServerLoad } from "./$types";

export const prerender = true;

export const entries: EntryGenerator = () => listItemIds().map((id) => ({ id }));

export const load: PageServerLoad = ({ params }) => {
  const presentation = getItemPresentation(params.id);
  if (!presentation) throw error(404, "Item not found");

  const relationships = listRelationshipSections("item", presentation.id);
  const categories = listCategoriesForItem(presentation.id);
  if (categories.length > 0) {
    relationships.push({
      id: "item-category",
      title: "Category",
      predicate: "categorised_as",
      edges: categories,
    });
  }
  const tags = listTagsForItem(presentation.id);
  if (tags.length > 0) {
    relationships.push({
      id: "item-tags",
      title: "Tags",
      predicate: "tagged",
      edges: tags,
    });
  }

  return {
    presentation,
    relationships,
  };
};
