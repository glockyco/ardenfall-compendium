import { describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import validateEntity from "../../pipeline/dist/validate-entity.mjs";
import { entityRegistry } from "$pipeline/entities/registry";
import { assertCanonicalTableContract } from "$pipeline/stages/emit-sqlite";
import { loadDescriptors } from "$pipeline/stages/load-descriptors";
import type { EntityDescriptor } from "$pipeline/types";

const baseEntity = (fields: EntityDescriptor["fields"]): EntityDescriptor => ({
  id: "record",
  kind: "definition",
  label: { singular: "Record", plural: "Records" },
  extraction: { source: "lookupAsset", root: "Records.Root" },
  canonicalTable: "records",
  fields,
});

const idField = { name: "id", type: "id" as const, from: "id", missingPolicy: "fatal" as const };

function table(sql: string): Database {
  const db = new Database(":memory:");
  db.exec(sql);
  return db;
}

describe("canonical table contract", () => {
  it("fails when a column field names a missing column", () => {
    const entity = baseEntity([
      idField,
      { name: "name", type: "string", from: "name", column: "missing_name" },
    ]);
    const db = table(`CREATE TABLE records (id TEXT PRIMARY KEY, name TEXT);`);

    expect(() => assertCanonicalTableContract(db, entity)).toThrow(
      /entity 'record' field 'name' declares missing column 'missing_name'.*field-to-column direction/,
    );
  });

  it("fails when a canonical column has no declared field", () => {
    const entity = baseEntity([idField, { name: "name", type: "string", from: "name" }]);
    const db = table(`CREATE TABLE records (id TEXT PRIMARY KEY, name TEXT, unexpected TEXT);`);

    expect(() => assertCanonicalTableContract(db, entity)).toThrow(
      /entity 'record'.*column 'unexpected' has no declared field.*column-to-field direction/,
    );
  });

  it("allows a projection without a local column", () => {
    const entity = baseEntity([
      idField,
      {
        name: "volumes",
        type: "json",
        from: "volumes",
        storage: "unstored",
        reason: "Expanded into projection rows.",
        projects: "record_volumes",
      },
    ]);
    const db = table(`CREATE TABLE records (id TEXT PRIMARY KEY);`);

    expect(() => assertCanonicalTableContract(db, entity)).not.toThrow();
  });

  it("requires a reason for an unstored field", () => {
    const invalid = {
      ...baseEntity([
        idField,
        { name: "discarded", type: "string", from: "discarded", storage: "unstored" },
      ]),
    };

    expect(validateEntity(invalid)).toBe(false);
    expect(validateEntity.errors?.some((error) => error.message?.includes("reason"))).toBe(true);
  });

  it("explains every existing canonical column", async () => {
    const descriptors = await loadDescriptors.run(
      {},
      { workspaceRoot: ".", snapshotDir: "", outDir: ".", log: () => undefined },
    );
    for (const [entityId, module] of Object.entries(entityRegistry)) {
      const entity = descriptors.entities[entityId];
      if (!entity) throw new Error(`missing descriptor '${entityId}'`);
      const db = new Database(":memory:");
      const variants = descriptors.variants[entityId] ?? [];
      db.exec(typeof module.ddl === "function" ? module.ddl(entity, variants) : module.ddl);
      expect(() => assertCanonicalTableContract(db, entity)).not.toThrow();
      db.close();
    }
  });
});
