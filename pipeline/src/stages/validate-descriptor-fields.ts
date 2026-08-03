import type { Stage } from "../types.ts";
import type { LoadDescriptorsOutput } from "./load-descriptors.ts";
import type { LoadSnapshotOutput } from "./load-snapshot.ts";

export interface ValidateDescriptorFieldsInputs {
  "load-descriptors": LoadDescriptorsOutput;
  "load-snapshot": LoadSnapshotOutput;
}

/**
 * Verifies that snapshot rows publish only fields described by their entity.
 * Item rows additionally inherit every field from their variant descriptors.
 */
export const validateDescriptorFields: Stage<ValidateDescriptorFieldsInputs, void> = {
  id: "validate-descriptor-fields",
  inputs: ["load-descriptors", "load-snapshot"],
  run: (inputs) => {
    const { entities, variants } = inputs["load-descriptors"];
    const { envelopes } = inputs["load-snapshot"];

    for (const [entityId, envelope] of Object.entries(envelopes)) {
      const entity = entities[entityId];
      if (!entity) {
        throw new Error(`snapshot entity '${entityId}' has no descriptor`);
      }

      const declared = new Set(entity.fields.map((field) => field.name));
      for (const variant of variants[entityId] ?? []) {
        for (const field of variant.fields) declared.add(field.name);
      }

      const samples = new Map<string, string>();
      for (const row of envelope.rows) {
        for (const fieldName of Object.keys(row.fields)) {
          if (!declared.has(fieldName) && !samples.has(fieldName)) {
            samples.set(fieldName, row.id);
          }
        }
      }
      if (samples.size > 0) {
        const detail = [...samples.entries()]
          .map(([fieldName, rowId]) => `field '${fieldName}' (sample row '${rowId}')`)
          .join(", ");
        throw new Error(`snapshot entity '${entityId}' emits undeclared ${detail}`);
      }
    }
  },
};
