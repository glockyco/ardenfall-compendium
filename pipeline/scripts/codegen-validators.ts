#!/usr/bin/env bun
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import standaloneCode from "ajv/dist/standalone";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const targets = [
  { schema: "schemas/entity.schema.json", out: "pipeline/dist/validate-entity.mjs" },
  { schema: "schemas/variant.schema.json", out: "pipeline/dist/validate-variant.mjs" },
  { schema: "schemas/manifest.schema.json", out: "pipeline/dist/validate-manifest.mjs" },
  { schema: "schemas/snapshot.schema.json", out: "pipeline/dist/validate-snapshot.mjs" },
  { schema: "schemas/digest.schema.json", out: "pipeline/dist/validate-digest.mjs" },
  {
    schema: "schemas/fixture-manifest.schema.json",
    out: "pipeline/dist/validate-fixture-manifest.mjs",
  },
];

// Single Ajv instance so $ref between schemas resolves.
const ajv = new Ajv2020({ code: { source: true, esm: true }, allErrors: true });
addFormats(ajv);

// Pre-load every schema so cross-schema $ref works.
for (const { schema } of targets) {
  const doc = JSON.parse(readFileSync(schema, "utf8"));
  ajv.addSchema(doc);
}

for (const { schema, out } of targets) {
  const doc = JSON.parse(readFileSync(schema, "utf8"));
  const validate = ajv.getSchema(doc.$id) ?? ajv.compile(doc);
  const code = standaloneCode(ajv, validate);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, code);
  console.warn(`wrote ${out}`);
}
