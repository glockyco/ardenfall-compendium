import { listLocations } from "#lib/server/read-models.js";
import type { PageServerLoad } from "./$types";

export const prerender = true;

export const load: PageServerLoad = () => ({ locations: listLocations() });
