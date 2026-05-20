import type { EntityDescriptor, FieldSpec, VariantDescriptor } from "../types.ts";

function sqlType(t: string): string {
  if (t === "id" || t === "string") return "TEXT";
  if (t === "integer" || t === "boolean") return "INTEGER";
  if (t === "number") return "REAL";
  if (t.startsWith("ref:")) return "TEXT"; // FK string id
  return "TEXT";
}

function column(field: FieldSpec): string {
  if (field.type === "id") return `"${field.name}" TEXT NOT NULL PRIMARY KEY`;
  const nullable = field.missingPolicy === "fatal" ? "NOT NULL" : "";
  return `"${field.name}" ${sqlType(field.type)} ${nullable}`.trim();
}

export function buildDDL(entity: EntityDescriptor, variants: VariantDescriptor[]): string {
  const out: string[] = [];

  // Root table.
  const rootColumns = entity.fields.map(column);
  rootColumns.push(`"variant" TEXT`);
  out.push(`CREATE TABLE "${entity.id}s" (${rootColumns.join(", ")});`);

  // Tags child table.
  out.push(
    `CREATE TABLE "${entity.id}_tag_refs" (` +
      `"${entity.id}_id" TEXT NOT NULL REFERENCES "${entity.id}s"("id"), ` +
      `"tag" TEXT NOT NULL, ` +
      `PRIMARY KEY ("${entity.id}_id", "tag"));`,
  );

  // Variant tables (each owns only its own fields).
  for (const variant of variants) {
    const cols: string[] = [`"id" TEXT NOT NULL PRIMARY KEY REFERENCES "${entity.id}s"("id")`];
    for (const f of variant.fields) {
      const nullable = f.missingPolicy === "fatal" ? "NOT NULL" : "";
      cols.push(`"${f.name}" ${sqlType(f.type)} ${nullable}`.trim());
    }
    out.push(`CREATE TABLE "${variant.canonicalTable}" (${cols.join(", ")});`);
  }

  return out.join("\n");
}
