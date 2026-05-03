import type { Stage } from "../types.ts";
import type { LoadDescriptorsOutput } from "./load-descriptors.ts";
import type { LoadSnapshotOutput } from "./load-snapshot.ts";

export interface ValidateInputs {
  "load-snapshot": LoadSnapshotOutput;
  "load-descriptors": LoadDescriptorsOutput;
}

export interface ValidateOutput {
  errors: { entity: string; row?: string; field?: string; code: string; message: string }[];
  countsBySeverity: { fatal: number; diagnostic: number };
}

export const validate: Stage<ValidateInputs, ValidateOutput> = {
  id: "validate",
  inputs: ["load-snapshot", "load-descriptors"],
  run: (inputs) => {
    const errors: ValidateOutput["errors"] = [];
    let fatal = 0;
    let diagnostic = 0;

    for (const [entityId, env] of Object.entries(inputs["load-snapshot"].envelopes)) {
      const entity = inputs["load-descriptors"].entities[entityId];
      if (!entity) {
        errors.push({
          entity: entityId,
          code: "unknownEntity",
          message: `snapshot has rows for '${entityId}' but no descriptor exists`,
        });
        fatal++;
        continue;
      }
      for (const row of env.rows) {
        for (const fieldSpec of entity.fields) {
          const present =
            Object.hasOwn(row.fields, fieldSpec.name) && row.fields[fieldSpec.name] !== undefined;
          if (!present && fieldSpec.missingPolicy === "fatal") {
            errors.push({
              entity: entityId,
              row: row.id,
              field: fieldSpec.name,
              code: "missingFatalField",
              message: `required field '${fieldSpec.name}' missing on row '${row.id}'`,
            });
            fatal++;
          } else if (!present && fieldSpec.missingPolicy === "diagnostic") {
            errors.push({
              entity: entityId,
              row: row.id,
              field: fieldSpec.name,
              code: "missingDiagnosticField",
              message: `optional-but-notable field '${fieldSpec.name}' missing on row '${row.id}'`,
            });
            diagnostic++;
          }
        }
        for (const d of row.diagnostics ?? []) {
          if (d.severity === "fatal") fatal++;
          else diagnostic++;
          errors.push({
            entity: entityId,
            row: row.id,
            field: d.field,
            code: d.code,
            message: d.message ?? d.code,
          });
        }
      }
    }
    return { errors, countsBySeverity: { fatal, diagnostic } };
  },
};
