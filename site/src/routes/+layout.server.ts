import { getEntity } from "$lib/server/read-models";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = () => ({
  itemRoute: getEntity("item")?.route_path ?? "/items",
  statTypeRoute: getEntity("stat-type")?.route_path ?? "/stats",
  itemCategoryRoute: getEntity("item-category")?.route_path ?? "/categories",
  itemTagRoute: getEntity("item-tag")?.route_path ?? "/tags",
});
