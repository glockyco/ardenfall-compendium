import { describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import validateEntity from "../../pipeline/dist/validate-entity.mjs";
import { entityRegistry } from "$pipeline/entities/registry";
import { runStages } from "$pipeline/orchestrator";
import { assertCanonicalTableContract, emitSqlite } from "$pipeline/stages/emit-sqlite";
import { emitAssets } from "$pipeline/stages/emit-assets";
import { loadDescriptors } from "$pipeline/stages/load-descriptors";
import { loadSnapshot } from "$pipeline/stages/load-snapshot";
import { validate } from "$pipeline/stages/validate";
import { validateDescriptorFields } from "$pipeline/stages/validate-descriptor-fields";
import type { EntityDescriptor, Stage } from "$pipeline/types";

const baseEntity = (fields: EntityDescriptor["fields"]): EntityDescriptor => ({
  id: "record",
  kind: "definition",
  label: { singular: "Record", plural: "Records" },
  extraction: { source: "lookupAsset", root: "Records.Root", file: "records.json" },
  canonicalTable: "records",
  fields,
});

const idField = { name: "id", type: "id" as const, from: "id", missingPolicy: "fatal" as const };

const releasesRoot = fileURLToPath(new URL("../artifacts/releases", import.meta.url));
/** Returns the newest release database, or undefined when no release is staged. */
function newestReleaseDatabase(): string | undefined {
  if (!existsSync(releasesRoot)) return undefined;
  const names = readdirSync(releasesRoot).sort();
  for (const name of names.reverse()) {
    const candidate = join(releasesRoot, name, "data.sqlite");
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

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

  // The descriptors generate the DDL, so reading the DDL back proves nothing. These two
  // assertions read databases a pipeline run produced instead. Each proves what it can.
  // The first builds the synthetic fixture here, so it covers every registered entity and
  // never depends on a staged artifact being fresh. The second reads a release, which is a
  // fixed historical file, so it covers only the entities that existed when it was cut.
  it("explains every column in a freshly built database", async () => {
    const out = mkdtempSync(join(tmpdir(), "ardenfall-contract-"));
    try {
      const stages = [
        loadDescriptors,
        loadSnapshot,
        validateDescriptorFields,
        validate,
        emitAssets,
        emitSqlite,
      ] as Stage<unknown, unknown>[];
      const result = await runStages(
        stages,
        {},
        {
          workspaceRoot: ".",
          snapshotDir: "fixtures/synthetic/snapshot",
          outDir: out,
          log: () => undefined,
        },
      );
      const descriptors = result["load-descriptors"] as {
        entities: Record<string, EntityDescriptor>;
      };
      const db = new Database(join(out, "data.sqlite"), { readonly: true });
      try {
        for (const entityId of Object.keys(entityRegistry)) {
          const entity = descriptors.entities[entityId];
          if (!entity) throw new Error(`missing descriptor '${entityId}'`);
          expect(() => assertCanonicalTableContract(db, entity)).not.toThrow();
        }
      } finally {
        db.close();
      }
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it("explains every column in the newest release database it covers", async () => {
    const releasePath = newestReleaseDatabase();
    if (releasePath === undefined) return;

    const descriptors = await loadDescriptors.run(
      {},
      { workspaceRoot: ".", snapshotDir: "", outDir: ".", log: () => undefined },
    );
    const db = new Database(releasePath, { readonly: true, create: false });
    try {
      const tables = new Set(
        db
          .query<{ name: string }, []>(`SELECT name FROM sqlite_master WHERE type = 'table'`)
          .all()
          .map((row) => row.name),
      );
      const checked: string[] = [];
      for (const entityId of Object.keys(entityRegistry)) {
        const entity = descriptors.entities[entityId];
        if (!entity) throw new Error(`missing descriptor '${entityId}'`);
        if (!tables.has(entity.canonicalTable)) continue;
        expect(() => assertCanonicalTableContract(db, entity)).not.toThrow();
        checked.push(entityId);
      }
      expect(checked.length).toBeGreaterThan(0);
    } finally {
      db.close();
    }
  });
});
