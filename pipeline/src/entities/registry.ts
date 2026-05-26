import type { LoadDescriptorsOutput } from "../stages/load-descriptors.ts";

export const canonicalizerSupport = {
  item: true,
  "stat-type": true,
  "item-category": true,
  "item-tag": true,
} as const satisfies Record<string, true>;

export const readModelSupport = {
  item: true,
  "stat-type": true,
  "item-category": true,
  "item-tag": true,
} as const satisfies Record<string, true>;

const hasOwn = <T extends object>(object: T, key: string): key is keyof T =>
  Object.prototype.hasOwnProperty.call(object, key);

export function validateDescriptorCoverage(desc: LoadDescriptorsOutput): void {
  const errors: string[] = [];
  for (const [entityId, entity] of Object.entries(desc.entities)) {
    if (!hasOwn(canonicalizerSupport, entityId)) {
      errors.push(`descriptor '${entityId}' has no pipeline canonicalizer`);
    }
    if (entity.site && !hasOwn(readModelSupport, entityId)) {
      errors.push(
        `descriptor '${entityId}' has no read-model emitter for public route '${entity.site.route}'`,
      );
    }
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
}
