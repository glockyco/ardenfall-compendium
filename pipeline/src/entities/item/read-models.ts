import type { Database } from "bun:sqlite";
import type { LoadDescriptorsOutput } from "../../stages/load-descriptors.ts";
import type {
  MasterTooltipVocabulary,
  SnapshotEnvelope,
  SnapshotItemIconMetadata,
} from "../../types.ts";
import { translateRichTextV1 } from "../../rich-text/rich-text-v1.ts";
import {
  ENTITY_GRAPH_DDL,
  insertPipelineDiagnostics,
} from "../../relationships/relationship-graph.ts";
import type { RichTextNode } from "../../rich-text/rich-text-v1.ts";
import { deriveShortId, deriveSlug } from "../../slug/derive-slug.ts";

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
  const itemRoute = desc.entities.item?.site?.route;
  if (itemRoute === undefined) {
    throw new Error(
      "emitItemReadModels: entity descriptor 'item' at entities/item/entity.json is missing site.route",
    );
  }
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
  const variantRoute = `${itemRoute}/variant`;
  const categoryInsert = db.prepare(
    `INSERT INTO item_overview_categories (category_id, label, href, item_count, sort_order) VALUES (?, ?, ?, ?, ?)`,
  );
  const filterInsert = db.prepare(
    `INSERT INTO item_overview_filters (filter_id, label, kind, options_json) VALUES (?, ?, ?, ?)`,
  );
  const categoryOptions = [...categories.entries()]
    .sort((a, b) => a[1].label.localeCompare(b[1].label))
    .map(([id, category], index) => {
      categoryInsert.run(id, category.label, `${variantRoute}/${id}`, category.count, index);
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
        ...(masterTooltip
          ? {
              tooltipCodes: masterTooltip.tooltipCodes,
              tooltipColors: masterTooltip.tooltipColors,
            }
          : {}),
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
        ...(masterTooltip
          ? {
              tooltipCodes: masterTooltip.tooltipCodes,
              tooltipColors: masterTooltip.tooltipColors,
            }
          : {}),
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
      if (variantId === undefined) {
        throw new Error(`Item '${snapshotRow.id}' is missing a variant`);
      }
      writeNode({
        entityType: "item",
        entityId: snapshotRow.id,
        label: itemLabel,
        routePath: `${itemRoute}/${snapshotRow.id}`,
      });
      aliasInsert.run(aliasKey(itemLabel), "item", snapshotRow.id, itemLabel, "item-presentation");
      presentationInsert.run(
        snapshotRow.id,
        item?.name ?? presentation.displayName,
        item?.variant ?? snapshotRow.variant ?? null,
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
        routePath: `${variantRoute}/${variantId}`,
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
        targetRoutePath: `${variantRoute}/${variantId}`,
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

export function deriveEntityNodeSlug(
  displayName: string,
  entityId: string,
): { canonicalSlug: string; shortId: string } {
  return {
    canonicalSlug: deriveSlug({ displayName, assetId: entityId }),
    shortId: deriveShortId(entityId),
  };
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
