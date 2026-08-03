import type { EntityDescriptor, FieldSpec, FieldType, VariantDescriptor } from "../types.ts";

function sqlType(fieldName: string, type: FieldType): string {
  switch (type) {
    case "id":
      return "TEXT";
    case "string":
      return "TEXT";
    case "integer":
      return "INTEGER";
    case "number":
      return "REAL";
    case "boolean":
      return "INTEGER";
    case "json":
      return "TEXT";
    case "ref:asset":
      return "TEXT";
    case "ref:asset[]":
      return "TEXT";
    case "ref:record":
      return "TEXT";
    default:
      return unsupportedFieldType(fieldName, type);
  }
}

function unsupportedFieldType(fieldName: string, type: never): never {
  throw new Error(`unsupported type '${type}' for field '${fieldName}'`);
}

function column(field: FieldSpec): string {
  const columnName = field.column ?? field.name;
  if (field.type === "id") return `"${columnName}" TEXT NOT NULL PRIMARY KEY`;
  const nullable = field.missingPolicy === "fatal" ? "NOT NULL" : "";
  return `"${columnName}" ${sqlType(field.name, field.type)} ${nullable}`.trim();
}

export function buildDDL(entity: EntityDescriptor, variants: VariantDescriptor[]): string {
  // Generation is deliberate for item and is strictly stronger than assertion.
  // The generated table cannot drift from its descriptor's stored fields.
  const out: string[] = [];

  // Root table.
  const rootColumns = entity.fields.filter((field) => field.storage !== "unstored").map(column);
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
      if (f.storage === "unstored") continue;
      const columnName = f.column ?? f.name;
      const nullable = f.missingPolicy === "fatal" ? "NOT NULL" : "";
      cols.push(`"${columnName}" ${sqlType(f.name, f.type)} ${nullable}`.trim());
    }
    out.push(`CREATE TABLE "${variant.canonicalTable}" (${cols.join(", ")});`);
  }

  return out.join("\n");
}
