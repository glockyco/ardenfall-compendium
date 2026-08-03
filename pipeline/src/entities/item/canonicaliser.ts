import type { Database } from "bun:sqlite";
import type { EntityDescriptor, SnapshotEnvelope, VariantDescriptor } from "../../types.ts";

function ancestry(variant: VariantDescriptor, all: VariantDescriptor[]): VariantDescriptor[] {
  const chain: VariantDescriptor[] = [];
  let cur: VariantDescriptor | undefined = variant;
  while (cur) {
    chain.unshift(cur);
    cur = cur.parentVariantId ? all.find((v) => v.variantId === cur!.parentVariantId) : undefined;
  }
  return chain;
}

function coerceForSqlite(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number" || typeof value === "string") return value;
  return JSON.stringify(value);
}

export function canonicaliseItems(
  db: Database,
  entity: EntityDescriptor,
  variants: VariantDescriptor[],
  envelope: SnapshotEnvelope,
): void {
  const rootFields = entity.fields.filter((f) => f.storage !== "unstored");
  const rootCols = rootFields.map((f) => f.column ?? f.name);
  const rootInsert = db.prepare(
    `INSERT INTO "${entity.id}s" (${[...rootCols, "variant"].map((c) => `"${c}"`).join(", ")}) ` +
      `VALUES (${[...rootCols, "variant"].map(() => "?").join(", ")})`,
  );
  const tagInsert = db.prepare(
    `INSERT INTO "${entity.id}_tag_refs" ("${entity.id}_id", "tag") VALUES (?, ?)`,
  );

  const variantInserters = new Map<string, ReturnType<Database["prepare"]>>();
  for (const v of variants) {
    const storedFields = v.fields.filter((f) => f.storage !== "unstored");
    const cols = ["id", ...storedFields.map((f) => f.column ?? f.name)];
    variantInserters.set(
      v.variantId,
      db.prepare(
        `INSERT INTO "${v.canonicalTable}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
      ),
    );
  }

  const tx = db.transaction(() => {
    for (const row of envelope.rows) {
      const variant = variants.find((v) => v.variantId === row.variant);
      if (!variant) {
        throw new Error(`row '${row.id}' has unknown variant '${row.variant ?? "<none>"}'`);
      }
      const rootValues = [
        ...rootFields.map((f) => coerceForSqlite(row.fields[f.name])),
        variant.variantId,
      ];
      rootInsert.run(...rootValues);
      for (const tag of row.tags ?? []) tagInsert.run(row.id, tag);
      for (const ancestor of ancestry(variant, variants)) {
        const inserter = variantInserters.get(ancestor.variantId);
        if (!inserter) throw new Error(`no inserter for variant ${ancestor.variantId}`);
        const storedFields = ancestor.fields.filter((f) => f.storage !== "unstored");
        const cols = ["id", ...storedFields.map((f) => f.column ?? f.name)];
        const values = [row.id, ...storedFields.map((f) => coerceForSqlite(row.fields[f.name]))];
        if (cols.length !== values.length) throw new Error("column/value mismatch");
        inserter.run(...values);
      }
    }
  });
  tx();
}
