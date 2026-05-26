import { all, assetSrc, get } from "../db";

interface ItemOverviewRecord {
  id: string;
  name: string | null;
  weight: number | null;
  value: number | null;
  variant: string | null;
  display_icon_hash: string | null;
  display_icon_color: string | null;
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
  variant: string | null;
  item_type: string | null;
  render_context: "item-presentation-v1";
  display_icon_hash: string | null;
  display_icon_color: string | null;
  description_source: string;
  description_rich_text_json: string;
  effects_source: string;
  effects_source_rich_text_json: string;
  effect_facts_json: string;
  stat_rows_json: string;
  requirements_json: string;
  durability_json: string | null;
  state_facts_json: string;
  omissions_json: string;
  value: number | null;
  weight: number | null;
  diagnostics_json: string;
}

export interface ItemOverviewRow {
  id: string;
  name: string | null;
  weight: number | null;
  value: number | null;
  variant: string | null;
  displayIconSrc: string | null;
  displayIconColor: string | null;
}

export interface ItemPresentationRow {
  id: string;
  name: string | null;
  variant: string | null;
  itemType: string | null;
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
  omissions: ItemPresentationOmission[];
  value: number | null;
  weight: number | null;
  diagnostics: ItemPresentationDiagnostic[];
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
      targetIsPublic?: boolean;
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

export interface ItemPresentationOmission {
  code: string;
  severity: "diagnostic";
  message: string;
}

export interface ItemPresentationDiagnostic {
  severity: "fatal" | "diagnostic";
  code: string;
  field: string;
  message: string;
}

export interface RelationshipSection {
  id: string;
  title: string;
  predicate: string;
  edges: RelationshipEdge[];
}

export interface RelationshipEdge {
  targetType: string;
  targetId: string;
  targetLabel: string;
  targetRoutePath: string;
  predicate: string;
  label: string;
  weight: number;
  anchor: string | null;
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
  isPublic: boolean;
}

const toItemPresentationRow = (row: ItemPresentationRecord): ItemPresentationRow => ({
  id: row.id,
  name: row.name,
  variant: row.variant,
  itemType: row.item_type,
  renderContext: row.render_context,
  displayIconSrc: assetSrc(row.display_icon_hash),
  displayIconColor: row.display_icon_color,
  description: JSON.parse(row.description_rich_text_json) as RichTextDocument,
  effectsSource: row.effects_source,
  effectsSourceRichText: JSON.parse(row.effects_source_rich_text_json) as RichTextDocument,
  effects: JSON.parse(row.effect_facts_json) as ItemPresentationEffect[],
  statRows: JSON.parse(row.stat_rows_json) as ItemPresentationStatRow[],
  requirements: JSON.parse(row.requirements_json) as ItemPresentationRequirement[],
  durability: row.durability_json
    ? (JSON.parse(row.durability_json) as ItemPresentationDurability)
    : null,
  stateFacts: JSON.parse(row.state_facts_json) as ItemPresentationStateFact[],
  omissions: JSON.parse(row.omissions_json) as ItemPresentationOmission[],
  value: row.value,
  weight: row.weight,
  diagnostics: JSON.parse(row.diagnostics_json) as ItemPresentationDiagnostic[],
});

const toItemOverviewRow = (row: ItemOverviewRecord): ItemOverviewRow => ({
  id: row.id,
  name: row.name,
  weight: row.weight,
  value: row.value,
  variant: row.variant,
  displayIconSrc: assetSrc(row.display_icon_hash),
  displayIconColor: row.display_icon_color,
});

export const listItemsOverview = (): ItemOverviewRow[] =>
  all<ItemOverviewRecord>("SELECT * FROM item_overview_rows ORDER BY name").map(toItemOverviewRow);

export const listItemsByVariant = (variant: string): ItemOverviewRow[] =>
  all<ItemOverviewRecord>("SELECT * FROM item_overview_rows WHERE variant = ? ORDER BY name", [
    variant,
  ]).map(toItemOverviewRow);

export const listItemsByCategory = (categoryId: string): ItemOverviewRow[] =>
  all<ItemOverviewRecord>(
    `SELECT o.id, o.name, o.weight, o.value, o.variant, o.display_icon_hash, o.display_icon_color
       FROM item_overview_rows o
       JOIN items i ON i.id = o.id
       WHERE json_extract(i."categoryRef", '$.guid') = ?
       ORDER BY o.name`,
    [categoryId],
  ).map(toItemOverviewRow);

export const listItemsByTag = (tagId: string): ItemOverviewRow[] =>
  all<ItemOverviewRecord>(
    `SELECT o.id, o.name, o.weight, o.value, o.variant, o.display_icon_hash, o.display_icon_color
       FROM item_overview_rows o
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
      options: JSON.parse(row.options_json) as ItemOverviewFilter["options"],
    }),
  );

export const listItemIds = (): string[] =>
  all<{ id: string }>("SELECT id FROM item_presentation_rows ORDER BY id").map((row) => row.id);

export const getItemPresentation = (id: string): ItemPresentationRow | undefined => {
  const row = get<ItemPresentationRecord>("SELECT * FROM item_presentation_rows WHERE id = ?", [
    id,
  ]);
  return row ? toItemPresentationRow(row) : undefined;
};

export const listRelationshipSections = (
  sourceType: string,
  sourceId: string,
): RelationshipSection[] =>
  all<{
    section_id: string;
    title: string;
    predicate: string;
    edges_json: string;
  }>(
    "SELECT section_id, title, predicate, edges_json FROM entity_relationship_sections WHERE source_type = ? AND source_id = ? ORDER BY sort_order, title",
    [sourceType, sourceId],
  ).map((row) => ({
    id: row.section_id,
    title: row.title,
    predicate: row.predicate,
    edges: JSON.parse(row.edges_json) as RelationshipEdge[],
  }));

export const listTermIds = (): string[] =>
  all<{ entity_id: string }>(
    "SELECT entity_id FROM entity_nodes WHERE entity_type = 'term' AND is_public = 1 ORDER BY entity_id",
  ).map((row) => row.entity_id);

export const getTerm = (id: string): EntityNode | undefined => {
  const row = get<{
    entity_type: string;
    entity_id: string;
    label: string;
    route_path: string;
  }>(
    "SELECT entity_type, entity_id, label, route_path FROM entity_nodes WHERE entity_type = 'term' AND entity_id = ? AND is_public = 1",
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
            canonical_slug AS canonicalSlug, short_id AS shortId, is_public AS isPublic
     FROM entity_nodes
     WHERE entity_type = ? AND canonical_slug = ? AND is_public = 1`,
    [entityType, canonicalSlug],
  );

export const getEntityNodeByShortId = (
  entityType: string,
  shortId: string,
): EntityNodeRow | undefined =>
  get<EntityNodeRow>(
    `SELECT entity_type AS entityType, entity_id AS entityId, label, route_path AS routePath,
            canonical_slug AS canonicalSlug, short_id AS shortId, is_public AS isPublic
     FROM entity_nodes
     WHERE entity_type = ? AND short_id = ? AND is_public = 1`,
    [entityType, shortId],
  );
