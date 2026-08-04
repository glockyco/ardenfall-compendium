import { all, assetSrc, get } from "../db";
import {
  isDurability,
  isEffectArray,
  isOptionsArray,
  isRequirementArray,
  isRichTextDocument,
  isStateFactArray,
  isStatRowArray,
  isStringRecord,
  parseGeneratedJson,
  validateRenderContext,
} from "../json";

interface ItemOverviewRecord {
  id: string;
  name: string;
  weight: number | null;
  value: number | null;
  variant: string | null;
  variant_label: string;
  display_icon_hash: string | null;
  display_icon_color: string | null;
  route_path: string;
}

interface ItemOverviewCategoryRecord {
  category_id: string;
  label: string;
  href: string;
  item_count: number;
  sort_order: number;
}

interface ItemOverviewFilterRecord {
  filter_id: string;
  label: string;
  kind: "multi-select";
  options_json: string;
}

interface ItemPresentationRecord {
  id: string;
  name: string | null;
  display_name: string;
  name_is_placeholder: number;
  item_type: string | null;
  render_context: string;
  display_icon_hash: string | null;
  display_icon_color: string | null;
  description_source: string;
  description_rich_text_json: string;
  effects_source: string;
  effects_source_rich_text_json: string;
  effect_facts_json: string;
  effect_target_routes_json: string;
  stat_rows_json: string;
  requirements_json: string;
  durability_json: string | null;
  state_facts_json: string;
  variant: string | null;
  value: number | null;
  weight: number | null;
}

export interface ItemOverviewRow {
  id: string;
  name: string;
  weight: number | null;
  value: number | null;
  variant: string | null;
  variantLabel: string;
  displayIconSrc: string | null;
  displayIconColor: string | null;
  routePath: string;
}

export interface ItemPresentationRow {
  id: string;
  name: string;
  variant: string | null;
  itemType: string | null;
  nameIsPlaceholder: boolean;
  renderContext: "item-presentation-v1";
  displayIconSrc: string | null;
  displayIconColor: string | null;
  description: RichTextDocument;
  effectsSource: string;
  effectsSourceRichText: RichTextDocument;
  effects: ItemPresentationEffect[];
  statRows: ItemPresentationStatRow[];
  requirements: ItemPresentationRequirement[];
  durability: ItemPresentationDurability | null;
  stateFacts: ItemPresentationStateFact[];
  value: number | null;
  weight: number | null;
}

export interface RichTextDocument {
  schemaVersion: 1;
  sourceHash: string;
  nodes: RichTextNode[];
  diagnostics: ItemPresentationDiagnostic[];
}

export type RichTextNode =
  | { type: "text"; text: string }
  | { type: "lineBreak" }
  | { type: "strong" | "emphasis" | "strike"; children: RichTextNode[] }
  | { type: "color"; token: string | null; color: string | null; children: RichTextNode[] }
  | { type: "sprite"; name: string }
  | {
      type: "termLink";
      termId: string;
      label: string;
      targetType?: string;
      targetId?: string;
      targetLabel?: string;
      targetRoutePath?: string;
      targetHasPage?: boolean;
    };

export interface ItemPresentationStatRow {
  id: string;
  label: string;
  value: number | null;
  valueText: string;
  suffix: string | null;
  size: string;
  indent: number;
  comparison: string | null;
  source: string;
}

export interface ItemPresentationRequirement {
  id: string;
  label: string;
  valueText: string;
  source: string;
}

export interface ItemPresentationEffect {
  kind: string;
  label: string;
  targetType: string | null;
  targetId: string | null;
  targetRoutePath: string | null;
  level: number | null;
  source: string;
}

export interface ItemPresentationDurability {
  kind: string;
  max: number;
  source: string;
}

export interface ItemPresentationStateFact {
  kind: string;
  label: string;
  description: string;
}

export interface ItemPresentationDiagnostic {
  severity: "fatal" | "diagnostic";
  code: string;
  field: string;
  message: string;
}

export interface ItemOverviewCategory {
  id: string;
  label: string;
  href: string;
  itemCount: number;
}

export interface ItemOverviewFilter {
  id: string;
  label: string;
  kind: "multi-select";
  options: { value: string; label: string; count: number }[];
}

export interface EntityNode {
  entityType: string;
  entityId: string;
  label: string;
  routePath: string;
}

export interface EntityNodeRow {
  entityType: string;
  entityId: string;
  label: string;
  routePath: string;
  canonicalSlug: string;
  shortId: string;
  hasPage: boolean;
}

const toItemPresentationRow = (row: ItemPresentationRecord): ItemPresentationRow => {
  const effectRoutes = parseGeneratedJson(
    row.effect_target_routes_json,
    "item",
    "effect_target_routes_json",
    row.id,
    isStringRecord,
  );
  const effects = parseGeneratedJson(
    row.effect_facts_json,
    "item",
    "effect_facts_json",
    row.id,
    isEffectArray,
  ).map((effect) => ({
    ...effect,
    level: typeof effect.level === "number" ? effect.level : null,
    targetRoutePath: effect.targetId === null ? null : (effectRoutes[effect.targetId] ?? null),
  }));

  return {
    id: row.id,
    name: row.display_name,
    variant: row.variant,
    nameIsPlaceholder: row.name_is_placeholder === 1,
    itemType: row.item_type,
    renderContext: validateRenderContext(
      row.render_context,
      "item",
      row.id,
      "item-presentation-v1",
    ),
    displayIconSrc: assetSrc(row.display_icon_hash),
    displayIconColor: row.display_icon_color,
    description: parseGeneratedJson(
      row.description_rich_text_json,
      "item",
      "description_rich_text_json",
      row.id,
      isRichTextDocument,
    ),
    effectsSource: row.effects_source,
    effectsSourceRichText: parseGeneratedJson(
      row.effects_source_rich_text_json,
      "item",
      "effects_source_rich_text_json",
      row.id,
      isRichTextDocument,
    ),
    effects,
    statRows: parseGeneratedJson(
      row.stat_rows_json,
      "item",
      "stat_rows_json",
      row.id,
      isStatRowArray,
    ),
    requirements: parseGeneratedJson(
      row.requirements_json,
      "item",
      "requirements_json",
      row.id,
      isRequirementArray,
    ),
    durability: row.durability_json
      ? parseGeneratedJson(row.durability_json, "item", "durability_json", row.id, isDurability)
      : null,
    stateFacts: parseGeneratedJson(
      row.state_facts_json,
      "item",
      "state_facts_json",
      row.id,
      isStateFactArray,
    ),
    value: row.value,
    weight: row.weight,
  };
};

const toItemOverviewRow = (row: ItemOverviewRecord): ItemOverviewRow => ({
  id: row.id,
  name: row.name,
  weight: row.weight,
  value: row.value,
  variant: row.variant,
  variantLabel: row.variant_label,
  displayIconSrc: assetSrc(row.display_icon_hash),
  displayIconColor: row.display_icon_color,
  routePath: row.route_path,
});

export const listItemsOverview = (): ItemOverviewRow[] =>
  all<ItemOverviewRecord>(
    `SELECT o.id, n.display_label AS name, o.weight, o.value, o.variant, v.label AS variant_label,
            o.display_icon_hash, o.display_icon_color, n.route_path
       FROM item_overview_rows o
       JOIN item_variants v ON v.variant_id = o.variant
       JOIN entity_nodes n
         ON n.entity_type = 'item'
        AND n.entity_id = o.id
       ORDER BY o.name`,
  ).map(toItemOverviewRow);

export const listItemsByVariant = (variant: string): ItemOverviewRow[] =>
  all<ItemOverviewRecord>(
    `SELECT o.id, n.display_label AS name, o.weight, o.value, o.variant, v.label AS variant_label,
            o.display_icon_hash, o.display_icon_color, n.route_path
       FROM item_overview_rows o
       JOIN item_variants v ON v.variant_id = o.variant
       JOIN entity_nodes n
         ON n.entity_type = 'item'
        AND n.entity_id = o.id
       WHERE o.variant = ?
       ORDER BY o.name`,
    [variant],
  ).map(toItemOverviewRow);

export const listItemsByCategory = (categoryId: string): ItemOverviewRow[] =>
  all<ItemOverviewRecord>(
    `SELECT o.id, n.display_label AS name, o.weight, o.value, o.variant, v.label AS variant_label,
            o.display_icon_hash, o.display_icon_color, n.route_path
       FROM item_overview_rows o
       JOIN item_variants v ON v.variant_id = o.variant
       JOIN entity_nodes n
         ON n.entity_type = 'item'
        AND n.entity_id = o.id
       JOIN items i ON i.id = o.id
       WHERE 'named;'
             || json_extract(i."categoryRef", '$.entity')
             || ';'
             || json_extract(i."categoryRef", '$.name') = ?
       ORDER BY o.name`,
    [categoryId],
  ).map(toItemOverviewRow);

export const listItemsByTag = (tagId: string): ItemOverviewRow[] =>
  all<ItemOverviewRecord>(
    `SELECT o.id, n.display_label AS name, o.weight, o.value, o.variant, v.label AS variant_label,
            o.display_icon_hash, o.display_icon_color, n.route_path
       FROM item_overview_rows o
       JOIN item_variants v ON v.variant_id = o.variant
       JOIN entity_nodes n
         ON n.entity_type = 'item'
        AND n.entity_id = o.id
       JOIN item_tag_refs refs ON refs.item_id = o.id
       WHERE refs.tag = ?
       ORDER BY o.name`,
    [tagId],
  ).map(toItemOverviewRow);

export const listItemOverviewCategories = (): ItemOverviewCategory[] =>
  all<ItemOverviewCategoryRecord>(
    "SELECT * FROM item_overview_categories ORDER BY sort_order, label",
  ).map((row) => ({
    id: row.category_id,
    label: row.label,
    href: row.href,
    itemCount: row.item_count,
  }));

export const listItemOverviewFilters = (): ItemOverviewFilter[] =>
  all<ItemOverviewFilterRecord>("SELECT * FROM item_overview_filters ORDER BY filter_id").map(
    (row) => ({
      id: row.filter_id,
      label: row.label,
      kind: row.kind,
      options: parseGeneratedJson(
        row.options_json,
        "item-overview",
        "options_json",
        row.filter_id,
        isOptionsArray,
      ),
    }),
  );

export const listItemIds = (): string[] =>
  all<{ id: string }>(
    // This feeds the prerenderer's route entries, so it must name only items that
    // have a page. A prototype carries a presentation row but no page, and asking
    // the prerenderer to visit one fails the build with a 404.
    `SELECT p.id
       FROM item_presentation_rows p
       JOIN entity_nodes n
         ON n.entity_type = 'item'
        AND n.entity_id = p.id
        AND n.has_page = 1
       ORDER BY p.id`,
  ).map((row) => row.id);

export const getItemPresentation = (id: string): ItemPresentationRow | undefined => {
  const row = get<ItemPresentationRecord>(
    `SELECT p.*, n.display_label AS display_name,
            COALESCE((
              SELECT json_group_object(target_id, route_path)
              FROM (
                SELECT json_extract(effect.value, '$.targetId') AS target_id, n.route_path
                FROM json_each(p.effect_facts_json) AS effect
                JOIN entity_nodes n
                  ON n.entity_type = json_extract(effect.value, '$.targetType')
                 AND n.entity_id = json_extract(effect.value, '$.targetId')
                 AND n.has_page = 1
              )
            ), '{}') AS effect_target_routes_json
       FROM item_presentation_rows p
       JOIN entity_nodes n
         ON n.entity_type = 'item' AND n.entity_id = p.id AND n.has_page = 1
       WHERE p.id = ?`,
    [id],
  );
  return row ? toItemPresentationRow(row) : undefined;
};

export const listTermIds = (): string[] =>
  all<{ entity_id: string }>(
    "SELECT entity_id FROM entity_nodes WHERE entity_type = 'term' AND has_page = 1 ORDER BY entity_id",
  ).map((row) => row.entity_id);

export const getTerm = (id: string): EntityNode | undefined => {
  const row = get<{
    entity_type: string;
    entity_id: string;
    label: string;
    route_path: string;
  }>(
    "SELECT entity_type, entity_id, label, route_path FROM entity_nodes WHERE entity_type = 'term' AND entity_id = ? AND has_page = 1",
    [id],
  );
  if (!row) return undefined;
  return {
    entityType: row.entity_type,
    entityId: row.entity_id,
    label: row.label,
    routePath: row.route_path,
  };
};

export const getEntityNodeBySlug = (
  entityType: string,
  canonicalSlug: string,
): EntityNodeRow | undefined =>
  get<EntityNodeRow>(
    `SELECT entity_type AS entityType, entity_id AS entityId, label, route_path AS routePath,
            canonical_slug AS canonicalSlug, short_id AS shortId, has_page AS hasPage
     FROM entity_nodes
     WHERE entity_type = ? AND canonical_slug = ? AND has_page = 1`,
    [entityType, canonicalSlug],
  );

export const getEntityNodeByShortId = (
  entityType: string,
  shortId: string,
): EntityNodeRow | undefined =>
  get<EntityNodeRow>(
    `SELECT entity_type AS entityType, entity_id AS entityId, label, route_path AS routePath,
            canonical_slug AS canonicalSlug, short_id AS shortId, has_page AS hasPage
     FROM entity_nodes
     WHERE entity_type = ? AND short_id = ? AND has_page = 1`,
    [entityType, shortId],
  );
