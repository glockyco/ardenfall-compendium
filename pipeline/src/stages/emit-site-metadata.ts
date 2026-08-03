import type { Database } from "bun:sqlite";
import type { LoadDescriptorsOutput } from "./load-descriptors.ts";
import type { FieldType } from "../types.ts";
import { entityRegistry } from "../entities/registry";

function valueKindOf(fieldName: string, type: FieldType): string {
  switch (type) {
    case "id":
      return "id";
    case "string":
      return "string";
    case "integer":
      return "integer";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "json":
      return "json";
    case "ref:asset":
      return "ref";
    case "ref:asset[]":
      return "json";
    case "ref:record":
      return "ref";
    default:
      return unsupportedFieldType(fieldName, type);
  }
}

function unsupportedFieldType(fieldName: string, type: never): never {
  throw new Error(`unsupported type '${type}' for field '${fieldName}'`);
}

function mapSourceTables(_entityId: string, renderKind: string): string[] {
  if (renderKind === "point-or-polygon") return ["map_points", "map_volumes"];
  if (renderKind === "polygon") return ["map_volumes"];
  return ["map_points"];
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
  const insertVariant = db.prepare(
    `INSERT INTO item_variants (variant_id, label, unity_type, canonical_table, parent_variant_id, position, is_public_route) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertReadModel = db.prepare(
    `INSERT INTO site_read_models (read_model_id, physical_name, entity_id, purpose) VALUES (?, ?, ?, ?)`,
  );
  const insertMapLayer = db.prepare(
    `INSERT INTO map_layers (
      layer_id, entity_id, source_table, source_tables_json, render_kind, icon,
      color_json, radius, tooltip_fields_json, filters_json, legend_label, z_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const tx = db.transaction(() => {
    for (const [entityId, entity] of Object.entries(desc.entities)) {
      const module = entityRegistry[entityId];
      if (entity.map) {
        const sourceTables = mapSourceTables(entityId, entity.map.renderKind);
        const sourceTable = sourceTables[0];
        if (sourceTable === undefined) {
          throw new Error(`map layer '${entity.map.layer}' has no source table`);
        }
        insertMapLayer.run(
          entity.map.layer,
          entityId,
          sourceTable,
          JSON.stringify(sourceTables),
          entity.map.renderKind,
          entity.map.icon ?? null,
          JSON.stringify(entity.map.color ?? [255, 255, 255]),
          entity.map.radius ?? null,
          JSON.stringify(entity.map.tooltip ?? []),
          JSON.stringify(entity.map.filters ?? []),
          entity.map.legendLabel ?? entity.label.plural,
          entity.map.zOrder ?? 0,
        );
      }
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
          valueKindOf(f.name, f.type),
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
            valueKindOf(f.name, f.type),
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
          const renderer = module?.site?.overviewRenderer?.(field) ?? "text";
          insertColumn.run(entityId, `col_${field}`, field, i, renderer, 1);
        });
      }
      for (const readModel of module?.site?.readModels ?? []) {
        insertReadModel.run(
          readModel.readModelId,
          readModel.physicalName,
          entityId,
          readModel.purpose,
        );
      }
    }

    for (const [entityId, module] of Object.entries(entityRegistry)) {
      if (!module.site?.emitVariants) continue;
      for (const v of desc.variants[entityId] ?? []) {
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
    }
  });
  tx();
}
