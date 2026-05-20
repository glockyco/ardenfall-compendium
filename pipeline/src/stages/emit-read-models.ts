import type { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import type { LoadDescriptorsOutput } from "./load-descriptors.ts";
import type {
  MasterTooltipVocabulary,
  SnapshotEnvelope,
  SnapshotItemIconMetadata,
} from "../types.ts";
import { translateRichTextV1 } from "../rich-text/rich-text-v1.ts";
import {
  ENTITY_GRAPH_DDL,
  auditEntityGraph,
  insertPipelineDiagnostics,
} from "../relationships/relationship-graph.ts";
import type { RichTextNode } from "../rich-text/rich-text-v1.ts";
import { deriveShortId, deriveSlug, kebab } from "../slug/derive-slug.ts";

export const ITEM_READ_MODEL_DDL = `
CREATE TABLE item_overview_rows (
  id                  TEXT NOT NULL PRIMARY KEY,
  name                TEXT,
  weight              REAL,
  value               INTEGER,
  variant             TEXT,
  display_icon_hash   TEXT,
  display_icon_color  TEXT
);
CREATE TABLE item_presentation_rows (
  id                          TEXT NOT NULL PRIMARY KEY,
  name                        TEXT,
  variant                     TEXT,
  item_type                   TEXT,
  render_context              TEXT NOT NULL,
  display_icon_hash           TEXT,
  display_icon_color          TEXT,
  description_source          TEXT NOT NULL,
  description_rich_text_json  TEXT NOT NULL,
  effects_source              TEXT NOT NULL,
  effects_source_rich_text_json TEXT NOT NULL,
  effect_facts_json           TEXT NOT NULL,
  stat_rows_json              TEXT NOT NULL,
  requirements_json           TEXT NOT NULL,
  durability_json             TEXT,
  state_facts_json            TEXT NOT NULL,
  omissions_json              TEXT NOT NULL,
  value                       INTEGER,
  weight                      REAL,
  diagnostics_json            TEXT NOT NULL
);
CREATE TABLE item_overview_filters (
  filter_id     TEXT NOT NULL PRIMARY KEY,
  label         TEXT NOT NULL,
  kind          TEXT NOT NULL,
  options_json  TEXT NOT NULL
);
CREATE TABLE item_overview_categories (
  category_id  TEXT NOT NULL PRIMARY KEY,
  label        TEXT NOT NULL,
  href         TEXT NOT NULL,
  item_count   INTEGER NOT NULL,
  sort_order   INTEGER NOT NULL
);
`;

export const STAT_TYPE_READ_MODEL_DDL = `
CREATE TABLE stat_type_overview_rows (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  grouping    TEXT NOT NULL,
  icon_hash   TEXT,
  icon_color  TEXT
);
CREATE TABLE stat_type_presentation_rows (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  grouping             TEXT NOT NULL,
  render_context       TEXT NOT NULL,
  icon_hash            TEXT,
  icon_color           TEXT,
  description          TEXT,
  long_description     TEXT,
  affects_json         TEXT NOT NULL DEFAULT '[]',
  skill_affects_json   TEXT NOT NULL DEFAULT '[]'
);
`;

export const ITEM_CATEGORY_READ_MODEL_DDL = `
CREATE TABLE item_category_overview_rows (
  id                       TEXT PRIMARY KEY,
  name                     TEXT NOT NULL,
  icon_hash                TEXT,
  default_item_icon_hash   TEXT,
  category_color_json      TEXT NOT NULL,
  item_count               INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE item_category_presentation_rows (
  id                       TEXT PRIMARY KEY,
  name                     TEXT NOT NULL,
  render_context           TEXT NOT NULL,
  icon_hash                TEXT,
  default_item_icon_hash   TEXT,
  category_color_json      TEXT NOT NULL,
  show_in_all_category     INTEGER NOT NULL,
  columns_json             TEXT NOT NULL,
  item_count               INTEGER NOT NULL DEFAULT 0
);
`;

export const ITEM_TAG_READ_MODEL_DDL = `
CREATE TABLE item_tag_overview_rows (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  item_count  INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE item_tag_presentation_rows (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  render_context  TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  item_count      INTEGER NOT NULL DEFAULT 0
);
`;

export interface EntityNodeInput {
  entityType: string;
  entityId: string;
  label: string;
  routePath: string;
  canonicalSlug?: string;
  shortId?: string;
  isPublic?: boolean;
}

export type EntityNodeWriter = (node: EntityNodeInput) => void;

export function prepareEntityNodeWriter(db: Database): EntityNodeWriter {
  const insert = db.prepare(
    `INSERT INTO entity_nodes (entity_type, entity_id, label, route_path, canonical_slug, short_id, is_public) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(entity_type, entity_id) DO NOTHING`,
  );

  return (node) => {
    const explicitCanonicalSlug = node.canonicalSlug;
    const explicitShortId = node.shortId;
    if ((explicitCanonicalSlug === undefined) !== (explicitShortId === undefined)) {
      throw new Error("entity node canonicalSlug and shortId must be provided together");
    }

    const slug =
      explicitCanonicalSlug === undefined
        ? deriveEntityNodeSlug(node.label, node.entityId)
        : { canonicalSlug: explicitCanonicalSlug, shortId: explicitShortId as string };

    insert.run(
      node.entityType,
      node.entityId,
      node.label,
      node.routePath,
      slug.canonicalSlug,
      slug.shortId,
      (node.isPublic ?? true) ? 1 : 0,
    );
  };
}

export function emitItemReadModels(
  db: Database,
  desc: LoadDescriptorsOutput,
  itemIconMetadata: SnapshotItemIconMetadata[] = [],
  itemEnvelope?: SnapshotEnvelope,
  masterTooltip?: MasterTooltipVocabulary,
): void {
  db.exec(ITEM_READ_MODEL_DDL);
  db.exec(ENTITY_GRAPH_DDL);
  const colorByItem = new Map(
    itemIconMetadata
      .filter((entry) => entry.entityId === "item")
      .map((entry) => [entry.rowId, JSON.stringify(entry.displayIconColor)]),
  );
  const overviewInsert = db.prepare(
    `INSERT INTO item_overview_rows (id, name, weight, value, variant, display_icon_hash, display_icon_color) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const overviewSource = db
    .query(
      `SELECT i.id, i.name, i.weight, i.value, i.variant, ar.asset_hash AS display_icon_hash
       FROM items i
       LEFT JOIN asset_refs ar
         ON ar.entity_id = 'item'
        AND ar.entity_row_id = i.id
        AND ar.slot = 'displayIcon'
        AND ar.asset_kind = 'image'`,
    )
    .all() as {
    id: string;
    name: string | null;
    weight: number | null;
    value: number | null;
    variant: string | null;
    display_icon_hash: string | null;
  }[];
  for (const row of overviewSource) {
    overviewInsert.run(
      row.id,
      row.name,
      row.weight,
      row.value,
      row.variant,
      row.display_icon_hash,
      colorByItem.get(row.id) ?? null,
    );
  }
  const categories = new Map<string, { label: string; count: number }>();
  for (const row of overviewSource) {
    if (!row.variant) continue;
    const current = categories.get(row.variant) ?? {
      label: titleCase(row.variant),
      count: 0,
    };
    current.count++;
    categories.set(row.variant, current);
  }
  const categoryInsert = db.prepare(
    `INSERT INTO item_overview_categories (category_id, label, href, item_count, sort_order) VALUES (?, ?, ?, ?, ?)`,
  );
  const filterInsert = db.prepare(
    `INSERT INTO item_overview_filters (filter_id, label, kind, options_json) VALUES (?, ?, ?, ?)`,
  );
  const categoryOptions = [...categories.entries()]
    .sort((a, b) => a[1].label.localeCompare(b[1].label))
    .map(([id, category], index) => {
      categoryInsert.run(id, category.label, `/items/variant/${id}`, category.count, index);
      return { value: id, label: category.label, count: category.count };
    });
  filterInsert.run("variant", "Variant", "multi-select", JSON.stringify(categoryOptions));

  if (!itemEnvelope) {
    throw new Error("emitItemReadModels: missing item envelope for item presentation rows");
  }
  const displayIconByItem = new Map<string, string | null>();
  for (const row of db
    .query(
      `SELECT entity_row_id, asset_hash FROM asset_refs WHERE entity_id = 'item' AND slot = 'displayIcon' AND asset_kind = 'image'`,
    )
    .all() as { entity_row_id: string; asset_hash: string }[]) {
    displayIconByItem.set(row.entity_row_id, row.asset_hash);
  }
  const itemById = new Map(
    (
      db.query("SELECT id, name, variant FROM items").all() as {
        id: string;
        name: string;
        variant: string;
      }[]
    ).map((row) => [row.id, row] as const),
  );
  const presentationInsert = db.prepare(
    `INSERT INTO item_presentation_rows (
      id, name, variant, item_type, render_context, display_icon_hash, display_icon_color,
      description_source, description_rich_text_json, effects_source, effects_source_rich_text_json,
      effect_facts_json, stat_rows_json, requirements_json, durability_json, state_facts_json,
      omissions_json, value, weight, diagnostics_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const writeNode = prepareEntityNodeWriter(db);
  const aliasInsert = db.prepare(
    `INSERT OR IGNORE INTO entity_aliases (alias_key, target_type, target_id, label, source) VALUES (?, ?, ?, ?, ?)`,
  );
  const edgeInsert = db.prepare(
    `INSERT OR IGNORE INTO entity_edges (edge_id, source_type, source_id, target_type, target_id, predicate, label, weight, evidence_json, anchor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const sectionInsert = db.prepare(
    `INSERT OR REPLACE INTO entity_relationship_sections (section_id, source_type, source_id, title, predicate, edges_json, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const richTextDiagnostics: Parameters<typeof insertPipelineDiagnostics>[1] = [];
  const tx = db.transaction(() => {
    for (const snapshotRow of itemEnvelope.rows) {
      const presentation = snapshotRow.presentation;
      if (!presentation) continue;
      const item = itemById.get(snapshotRow.id);
      const description = translateRichTextV1(presentation.descriptionSource, {
        tooltipCodes: masterTooltip?.tooltipCodes,
        tooltipColors: masterTooltip?.tooltipColors,
        resolveTerm: (termId, label) => ({
          termId,
          label,
          targetType: "term",
          targetId: termId,
          targetLabel: masterTooltip?.tooltipCodes[termId] ?? label,
          targetRoutePath: `/terms/${termId}`,
          targetIsPublic: true,
        }),
      });
      const effectsSource = translateRichTextV1(presentation.effectsSource, {
        tooltipCodes: masterTooltip?.tooltipCodes,
        tooltipColors: masterTooltip?.tooltipColors,
        resolveTerm: (termId, label) => ({
          termId,
          label,
          targetType: "term",
          targetId: termId,
          targetLabel: masterTooltip?.tooltipCodes[termId] ?? label,
          targetRoutePath: `/terms/${termId}`,
          targetIsPublic: true,
        }),
      });
      const itemLabel = item?.name ?? presentation.displayName;
      const variantId = item?.variant ?? snapshotRow.variant;
      writeNode({
        entityType: "item",
        entityId: snapshotRow.id,
        label: itemLabel,
        routePath: `/items/${snapshotRow.id}`,
      });
      aliasInsert.run(aliasKey(itemLabel), "item", snapshotRow.id, itemLabel, "item-presentation");
      presentationInsert.run(
        snapshotRow.id,
        item?.name ?? presentation.displayName,
        item?.variant ?? snapshotRow.variant,
        presentation.itemType,
        presentation.renderContext,
        displayIconByItem.get(snapshotRow.id) ?? null,
        colorByItem.get(snapshotRow.id) ?? null,
        presentation.descriptionSource,
        JSON.stringify(description),
        presentation.effectsSource,
        JSON.stringify(effectsSource),
        JSON.stringify(presentation.effects),
        JSON.stringify(presentation.statRows),
        JSON.stringify(presentation.requirements),
        presentation.durability ? JSON.stringify(presentation.durability) : null,
        JSON.stringify(presentation.stateFacts),
        JSON.stringify(presentation.omissions),
        presentation.value,
        presentation.weight,
        JSON.stringify([
          ...presentation.diagnostics,
          ...description.diagnostics,
          ...effectsSource.diagnostics,
        ]),
      );

      for (const diagnostic of [...description.diagnostics, ...effectsSource.diagnostics]) {
        richTextDiagnostics.push({
          severity: diagnostic.severity,
          source: "rich-text",
          code: diagnostic.code,
          message: diagnostic.message,
          entityType: "item",
          entityId: snapshotRow.id,
          field: diagnostic.field,
        });
      }

      const variant = desc.variants.item?.find((candidate) => candidate.variantId === variantId);
      const variantLabel = variant?.label ?? titleCase(variantId);
      writeNode({
        entityType: "item-variant",
        entityId: variantId,
        label: variantLabel,
        routePath: `/items/variant/${variantId}`,
        canonicalSlug: variantId,
        shortId: variantId,
      });
      aliasInsert.run(
        aliasKey(variantLabel),
        "item-variant",
        variantId,
        variantLabel,
        "item-variant",
      );
      const variantEdge = {
        targetType: "item-variant",
        targetId: variantId,
        targetLabel: variantLabel,
        targetRoutePath: `/items/variant/${variantId}`,
        predicate: "variant_of",
        label: "Variant",
        weight: 1,
        anchor: "item-header",
      };
      edgeInsert.run(
        `${snapshotRow.id}:variant_of:item-variant:${variantId}`,
        "item",
        snapshotRow.id,
        "item-variant",
        variantId,
        "variant_of",
        "Variant",
        1,
        JSON.stringify({ source: "items.variant" }),
        "item-header",
      );
      sectionInsert.run(
        `${snapshotRow.id}:variant_of`,
        "item",
        snapshotRow.id,
        "Variant",
        "variant_of",
        JSON.stringify([variantEdge]),
        10,
      );

      const termEdges = [];
      for (const term of collectTermLinks(description.nodes)) {
        const termLabel = masterTooltip?.tooltipCodes[term.termId] ?? term.label;
        writeNode({
          entityType: "term",
          entityId: term.termId,
          label: termLabel,
          routePath: `/terms/${term.termId}`,
          canonicalSlug: term.termId,
          shortId: term.termId,
        });
        aliasInsert.run(aliasKey(termLabel), "term", term.termId, termLabel, "master-tooltip");
        edgeInsert.run(
          `${snapshotRow.id}:references_term:term:${term.termId}`,
          "item",
          snapshotRow.id,
          "term",
          term.termId,
          "references_term",
          termLabel,
          0.5,
          JSON.stringify({ source: "presentation.descriptionSource" }),
          "description",
        );
        termEdges.push({
          targetType: "term",
          targetId: term.termId,
          targetLabel: termLabel,
          targetRoutePath: `/terms/${term.termId}`,
          predicate: "references_term",
          label: termLabel,
          weight: 0.5,
          anchor: "description",
        });
      }
      if (termEdges.length > 0) {
        sectionInsert.run(
          `${snapshotRow.id}:references_term`,
          "item",
          snapshotRow.id,
          "Referenced terms",
          "references_term",
          JSON.stringify(termEdges),
          90,
        );
      }
    }
  });
  tx();
  insertPipelineDiagnostics(db, richTextDiagnostics, "item-presentation-read-model");
  insertPipelineDiagnostics(db, auditEntityGraph(db), "item-presentation-read-model");
}

export function emitStatTypeReadModels(db: Database, masterTooltip: MasterTooltipVocabulary): void {
  db.exec(STAT_TYPE_READ_MODEL_DDL);
  db.exec(ENTITY_GRAPH_DDL);
  const overviewInsert = db.prepare(
    `INSERT INTO stat_type_overview_rows (id, name, grouping, icon_hash, icon_color) VALUES (?, ?, ?, ?, ?)`,
  );
  const presentationInsert = db.prepare(
    `INSERT INTO stat_type_presentation_rows (
      id, name, grouping, render_context, icon_hash, icon_color,
      description, long_description, affects_json, skill_affects_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const writeNode = prepareEntityNodeWriter(db);
  const skillIds = new Set(masterTooltip.allSkills);
  const rows = db
    .query<
      {
        id: string;
        is_attribute: number;
        stat_name: string;
        icon_hash: string | null;
        icon_color_json: string | null;
        stat_description: string | null;
        long_stat_description: string | null;
        affects_json: string;
        skill_affects_json: string;
      },
      []
    >(
      `SELECT s.id, s.is_attribute, s.stat_name, ar.asset_hash AS icon_hash,
              s.icon_color_json, s.stat_description, s.long_stat_description,
              s.affects_json, s.skill_affects_json
       FROM stat_types s
       LEFT JOIN asset_refs ar
         ON ar.entity_id = 'stat-type'
        AND ar.entity_row_id = s.id
        AND ar.slot = 'iconRef'
        AND ar.asset_kind = 'image'
       ORDER BY s.stat_name`,
    )
    .all();

  const tx = db.transaction(() => {
    for (const row of rows) {
      const grouping =
        row.is_attribute === 1 ? "attribute" : skillIds.has(row.id) ? "skill" : "trait";
      overviewInsert.run(row.id, row.stat_name, grouping, row.icon_hash, row.icon_color_json);
      presentationInsert.run(
        row.id,
        row.stat_name,
        grouping,
        "stat-type-presentation-v1",
        row.icon_hash,
        row.icon_color_json,
        row.stat_description,
        row.long_stat_description,
        row.affects_json,
        row.skill_affects_json,
      );
      const slug = deriveEntityNodeSlug(row.stat_name, row.id);
      writeNode({
        entityType: "stat-type",
        entityId: row.id,
        label: row.stat_name,
        routePath: `/stats/${slug.canonicalSlug}`,
        canonicalSlug: slug.canonicalSlug,
        shortId: slug.shortId,
      });
    }
  });
  tx();
}

export function emitItemCategoryReadModels(db: Database): void {
  db.exec(ITEM_CATEGORY_READ_MODEL_DDL);
  db.exec(ENTITY_GRAPH_DDL);
  const overviewInsert = db.prepare(
    `INSERT INTO item_category_overview_rows (
      id, name, icon_hash, default_item_icon_hash, category_color_json, item_count
    ) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const presentationInsert = db.prepare(
    `INSERT INTO item_category_presentation_rows (
      id, name, render_context, icon_hash, default_item_icon_hash, category_color_json,
      show_in_all_category, columns_json, item_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const writeNode = prepareEntityNodeWriter(db);
  const rows = db
    .query<
      {
        id: string;
        category_name: string;
        icon_hash: string | null;
        default_item_icon_hash: string | null;
        category_color_json: string;
        show_in_all_category: number;
        columns_json: string;
        item_count: number;
      },
      []
    >(
      `SELECT c.id, c.category_name, icon.asset_hash AS icon_hash,
              default_icon.asset_hash AS default_item_icon_hash,
              c.category_color_json, c.show_in_all_category, c.columns_json,
              (
                SELECT COUNT(*)
                FROM items i
                WHERE json_extract(i."categoryRef", '$.guid') = c.id
                   OR i."categoryName" = c.category_name
              ) AS item_count
       FROM item_categories c
       LEFT JOIN asset_refs icon
         ON icon.entity_id = 'item-category'
        AND icon.entity_row_id = c.id
        AND icon.slot = 'iconRef'
        AND icon.asset_kind = 'image'
       LEFT JOIN asset_refs default_icon
         ON default_icon.entity_id = 'item-category'
        AND default_icon.entity_row_id = c.id
        AND default_icon.slot = 'defaultItemIconRef'
        AND default_icon.asset_kind = 'image'
       ORDER BY c.category_name`,
    )
    .all();

  const tx = db.transaction(() => {
    for (const row of rows) {
      overviewInsert.run(
        row.id,
        row.category_name,
        row.icon_hash,
        row.default_item_icon_hash,
        row.category_color_json,
        row.item_count,
      );
      presentationInsert.run(
        row.id,
        row.category_name,
        "item-category-presentation-v1",
        row.icon_hash,
        row.default_item_icon_hash,
        row.category_color_json,
        row.show_in_all_category,
        row.columns_json,
        row.item_count,
      );
      const slug = deriveEntityNodeSlug(row.category_name, row.id);
      writeNode({
        entityType: "item-category",
        entityId: row.id,
        label: row.category_name,
        routePath: `/categories/${slug.canonicalSlug}`,
        canonicalSlug: slug.canonicalSlug,
        shortId: slug.shortId,
      });
    }
  });
  tx();
}

export function emitItemTagReadModels(db: Database): void {
  db.exec(ITEM_TAG_READ_MODEL_DDL);
  db.exec(ENTITY_GRAPH_DDL);
  const overviewInsert = db.prepare(
    `INSERT INTO item_tag_overview_rows (id, name, description, item_count) VALUES (?, ?, ?, ?)`,
  );
  const presentationInsert = db.prepare(
    `INSERT INTO item_tag_presentation_rows (
      id, name, render_context, description, item_count
    ) VALUES (?, ?, ?, ?, ?)`,
  );
  const writeNode = prepareEntityNodeWriter(db);
  const rows = db
    .query<
      {
        id: string;
        tag_name: string;
        description: string;
        item_count: number;
      },
      []
    >(
      `SELECT t.id, t.tag_name, t.description,
              (
                SELECT COUNT(*)
                FROM item_tag_refs refs
                WHERE refs.tag = t.id
              ) AS item_count
       FROM item_tags t
       ORDER BY t.tag_name`,
    )
    .all();

  const tx = db.transaction(() => {
    for (const row of rows) {
      overviewInsert.run(row.id, row.tag_name, row.description, row.item_count);
      presentationInsert.run(
        row.id,
        row.tag_name,
        "item-tag-presentation-v1",
        row.description,
        row.item_count,
      );
      const slug = deriveEntityNodeSlug(row.tag_name, row.id);
      writeNode({
        entityType: "item-tag",
        entityId: row.id,
        label: row.tag_name,
        routePath: `/tags/${slug.canonicalSlug}`,
        canonicalSlug: slug.canonicalSlug,
        shortId: slug.shortId,
      });
    }
  });
  tx();
}

function collectTermLinks(nodes: RichTextNode[]): { termId: string; label: string }[] {
  const terms: { termId: string; label: string }[] = [];
  for (const node of nodes) {
    if (node.type === "termLink") {
      terms.push({ termId: node.termId, label: node.label });
    } else if ("children" in node) {
      terms.push(...collectTermLinks(node.children));
    }
  }
  return terms;
}

function deriveEntityNodeSlug(
  displayName: string,
  entityId: string,
): { canonicalSlug: string; shortId: string } {
  try {
    return {
      canonicalSlug: deriveSlug({ displayName, assetId: entityId }),
      shortId: deriveShortId(entityId),
    };
  } catch {
    const shortId = createHash("sha256").update(entityId).digest("hex").slice(0, 8);
    const head = kebab(displayName) || "entity";
    return { canonicalSlug: `${head}--${shortId}`, shortId };
  }
}

function aliasKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");
}

function titleCase(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}
