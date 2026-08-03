import { listPlacedCharacters } from "$lib/server/read-models";
import type { PageServerLoad } from "./$types";

export const prerender = true;

export const load: PageServerLoad = () => ({ placedCharacters: listPlacedCharacters() });
