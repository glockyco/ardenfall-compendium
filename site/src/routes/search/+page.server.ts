import { listRouteSections } from "$lib/server/read-models";
import type { PageServerLoad } from "./$types";

/**
 * Routes a reader can reach that are not entity pages, so no table names them.
 * `/terms` holds glossary entries that belong to the items section.
 */
const extraSections = [
  { prefix: "/terms", label: "Items" },
  { prefix: "/map", label: "Map" },
];

export const load: PageServerLoad = () => ({
  sections: [...listRouteSections(), ...extraSections],
});
