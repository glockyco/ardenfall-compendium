import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import validateEntity from "../../dist/validate-entity.mjs";
import validateVariant from "../../dist/validate-variant.mjs";
import type { EntityDescriptor, Stage, VariantDescriptor } from "../types.ts";

export interface LoadDescriptorsOutput {
  entities: Record<string, EntityDescriptor>;
  variants: Record<string, VariantDescriptor[]>;
}

export const loadDescriptors: Stage<unknown, LoadDescriptorsOutput> = {
  id: "load-descriptors",
  inputs: [],
  run: (_inputs, ctx) => {
    const entitiesDir = join(ctx.workspaceRoot, "entities");
    const out: LoadDescriptorsOutput = { entities: {}, variants: {} };

    for (const dirName of readdirSync(entitiesDir)) {
      if (dirName.startsWith("_") || dirName.startsWith(".")) continue;
      const dirPath = join(entitiesDir, dirName);
      if (!statSync(dirPath).isDirectory()) continue;

      const entityPath = join(dirPath, "entity.json");
      const entityDoc = JSON.parse(readFileSync(entityPath, "utf8")) as EntityDescriptor;
      if (!validateEntity(entityDoc)) {
        const detail = (validateEntity.errors ?? [])
          .map((e) => `${entityPath}#${e.instancePath} — ${e.message}`)
          .join("\n");
        throw new Error(`invalid entity descriptor at ${entityPath}:\n${detail}`);
      }
      if (entityDoc.id !== dirName) {
        throw new Error(
          `descriptor id mismatch at ${entityPath}: id='${entityDoc.id}' but folder='${dirName}'`,
        );
      }
      out.entities[entityDoc.id] = entityDoc;

      const variantsDir = entityDoc.variants ? join(dirPath, entityDoc.variants.dir) : null;
      const variantList: VariantDescriptor[] = [];
      if (variantsDir) {
        for (const fileName of readdirSync(variantsDir).sort()) {
          if (!fileName.endsWith(".json")) continue;
          const variantPath = join(variantsDir, fileName);
          const variantDoc = JSON.parse(readFileSync(variantPath, "utf8")) as VariantDescriptor;
          if (!validateVariant(variantDoc)) {
            const detail = (validateVariant.errors ?? [])
              .map((e) => `${variantPath}#${e.instancePath} — ${e.message}`)
              .join("\n");
            throw new Error(`invalid variant descriptor at ${variantPath}:\n${detail}`);
          }
          variantList.push(variantDoc);
        }
      }
      out.variants[entityDoc.id] = variantList;
    }
    return out;
  },
};
