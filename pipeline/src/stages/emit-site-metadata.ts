import type { Database } from "bun:sqlite";
import type { LoadDescriptorsOutput } from "./load-descriptors.ts";

function valueKindOf(type: string): string {
  if (type === "id") return "id";
  if (type === "string") return "string";
  if (type === "integer") return "integer";
  if (type === "number") return "number";
  if (type === "boolean") return "boolean";
  if (type.startsWith("ref:")) return "ref";
  return "string";
}

export function emitSiteMetadata(db: Database, desc: LoadDescriptorsOutput): void {
  const insertEntity = db.prepare(
    `INSERT INTO site_entities (entity_id, singular_label, plural_label, route_path, canonical_table) VALUES (?, ?, ?, ?, ?)`,
  );
  const insertField = db.prepare(
    `INSERT INTO site_entity_fields (entity_id, field_id, source_table, source_column, label, value_kind, null_policy) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertColumn = db.prepare(
    `INSERT INTO site_overview_columns (entity_id, column_id, field_id, position, renderer, sortable) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const insertSection = db.prepare(
    `INSERT INTO site_detail_sections (entity_id, section_id, kind, title, position, renderer_key, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertSectionField = db.prepare(
    `INSERT INTO site_detail_section_fields (entity_id, section_id, field_id, position) VALUES (?, ?, ?, ?)`,
  );
  const insertVariant = db.prepare(
    `INSERT INTO item_variants (variant_id, label, unity_type, canonical_table, parent_variant_id, position, is_public_route) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertReadModel = db.prepare(
    `INSERT INTO site_read_models (read_model_id, physical_name, entity_id, purpose) VALUES (?, ?, ?, ?)`,
  );

  const tx = db.transaction(() => {
    for (const [entityId, entity] of Object.entries(desc.entities)) {
      if (!entity.site) continue;
      insertEntity.run(
        entityId,
        entity.label.singular,
        entity.label.plural,
        entity.site.route,
        `${entityId}s`,
      );
      for (const f of entity.fields) {
        insertField.run(
          entityId,
          f.name,
          `${entityId}s`,
          f.name,
          f.label ?? f.name,
          valueKindOf(f.type),
          f.missingPolicy ?? "diagnostic",
        );
      }
      // Variant fields land on their canonical_table:
      for (const v of desc.variants[entityId] ?? []) {
        for (const f of v.fields) {
          insertField.run(
            entityId,
            `${v.variantId}.${f.name}`,
            v.canonicalTable,
            f.name,
            f.label ?? f.name,
            valueKindOf(f.type),
            f.missingPolicy ?? "diagnostic",
          );
        }
      }
      if ((desc.variants[entityId] ?? []).length > 0) {
        // Synthetic variant column (route filter):
        insertField.run(
          entityId,
          "variant",
          `${entityId}s`,
          "variant",
          "Variant",
          "string",
          "diagnostic",
        );
      }

      const overview = entity.site?.overview;
      if (overview) {
        overview.columns.forEach((field, i) => {
          const renderer = entityId === "item" && field === "name" ? "itemNameWithIcon" : "text";
          insertColumn.run(entityId, `col_${field}`, field, i, renderer, 1);
        });
      }
      const detail = entity.site?.detail;
      if (detail) {
        detail.sections.forEach((section, i) => {
          if (section.kind === "fieldList") {
            insertSection.run(entityId, section.id, "fieldList", section.title, i, null, null);
            section.fields.forEach((field, j) =>
              insertSectionField.run(entityId, section.id, field, j),
            );
          } else {
            insertSection.run(
              entityId,
              section.id,
              "custom",
              section.title,
              i,
              section.renderer,
              JSON.stringify(section.props ?? {}),
            );
          }
        });
      }
      if (entityId === "item") {
        // Default read models consumed by the item overview and detail routes.
        insertReadModel.run("item_overview_rows", "item_overview_rows", entityId, "overview");
        insertReadModel.run("item_presentation_rows", "item_presentation_rows", entityId, "detail");
      }
    }

    for (const v of desc.variants.item ?? []) {
      insertVariant.run(
        v.variantId,
        v.label,
        v.unityType,
        v.canonicalTable,
        v.parentVariantId ?? null,
        v.position ?? 0,
        v.isPublicRoute ? 1 : 0,
      );
    }
  });
  tx();
}
