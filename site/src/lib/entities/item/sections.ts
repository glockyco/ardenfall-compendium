import type { SectionMap } from "$lib/entity/registry.js";
import MeleeStats from "./sections/MeleeStats.svelte";

/**
 * Per-item custom-renderer registry.
 *
 * Slice 1 ships a `meleeStats` renderer to prove the registry shape end-to-end;
 * Slice 1's `entities/item/entity.json` does not yet emit a `custom`-kind
 * detail section that points at it, so the registry is loaded but unused at
 * the route level. Slice 2 adds the descriptor binding.
 */
export const sections: SectionMap = {
  "item.meleeStats": MeleeStats,
};
