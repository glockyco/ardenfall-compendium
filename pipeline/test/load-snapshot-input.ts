import { loadDescriptors } from "$pipeline/stages/load-descriptors";
import type { LoadDescriptorsOutput } from "$pipeline/stages/load-descriptors";
import type { StageContext } from "$pipeline/types";

export function descriptorsForFamilies(
  ctx: StageContext,
  entityIds?: readonly string[],
): LoadDescriptorsOutput {
  const all = loadDescriptors.run({}, ctx);
  if (all instanceof Promise) {
    throw new Error("load-descriptors returned a promise in synchronous test helper");
  }
  if (entityIds === undefined) return all;
  const selected = new Set(entityIds);
  return {
    entities: Object.fromEntries(
      Object.entries(all.entities).filter(([entityId]) => selected.has(entityId)),
    ),
    variants: Object.fromEntries(
      Object.entries(all.variants).filter(([entityId]) => selected.has(entityId)),
    ),
  };
}
