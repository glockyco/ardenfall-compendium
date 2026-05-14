import type { SectionMap } from "$lib/entity/registry.js";
import MeleeStats from "./sections/MeleeStats.svelte";

/**
 * Per-item custom-renderer registry.
 *
 * The `meleeStats` renderer proves the registry shape end-to-end. The current
 * `entities/item/entity.json` does not yet emit a `custom`-kind detail section
 * that points at it, so the registry is loaded but unused at the route level.
 * Item subtype enrichment will add the descriptor binding when the fields exist.
 */
export const sections: SectionMap = {
  "item.meleeStats": MeleeStats,
};
