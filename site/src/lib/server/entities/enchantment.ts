import { all, get } from "../db";
import { isRecord, isRichTextDocument, parseGeneratedJson, validateRenderContext } from "../json";
import type { RichTextDocument } from "./item";
import { getEntityNodeBySlug } from "./item";

interface EnchantmentOverviewRecord {
  id: string;
  route_path: string;
  display_label: string;
}

interface EnchantmentPresentationRecord {
  id: string;
  render_context: string;
  money_value: number;
  hide_effect_tooltips: number;
  tooltip_rich_text_json: string | null;
  items_json: string;
  effects_json: string;
  route_path: string;
  display_label: string;
}

export interface EnchantmentItemRef {
  itemId: string;
  itemLabel: string;
  itemRoutePath: string | null;
}

interface EnchantmentEffectRecord {
  ordinal: number;
  kind: string;
  tooltipRichText: RichTextDocument | null;
  statusEffectId: string | null;
  statusEffectLabel: string | null;
  statusEffectRoutePath: string | null;
}

export interface EnchantmentEffect {
  ordinal: number;
  kind: string;
  description: RichTextDocument | null;
  statusEffectId: string | null;
  statusEffectLabel: string | null;
  statusEffectRoutePath: string | null;
}

export interface EnchantmentOverviewRow {
  id: string;
  name: string;
  routePath: string;
}

export interface EnchantmentPresentationRow {
  id: string;
  name: string;
  renderContext: "enchantment-presentation-v1";
  moneyValue: number;
  hideEffectTooltips: boolean;
  description: RichTextDocument | null;
  appliesToItemRefs: EnchantmentItemRef[];
  effects: EnchantmentEffect[];
  routePath: string;
}

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === "string";
const isEnchantmentItemRef = (value: unknown): value is EnchantmentItemRef =>
  isRecord(value) &&
  typeof value.itemId === "string" &&
  typeof value.itemLabel === "string" &&
  isNullableString(value.itemRoutePath);
const isEnchantmentItemRefArray = (value: unknown): value is EnchantmentItemRef[] =>
  Array.isArray(value) && value.every(isEnchantmentItemRef);
const isEnchantmentEffect = (value: unknown): value is EnchantmentEffectRecord =>
  isRecord(value) &&
  typeof value.ordinal === "number" &&
  Number.isInteger(value.ordinal) &&
  typeof value.kind === "string" &&
  isNullableString(value.statusEffectId) &&
  isNullableString(value.statusEffectLabel) &&
  isNullableString(value.statusEffectRoutePath) &&
  (value.tooltipRichText === null || isRichTextDocument(value.tooltipRichText));
const isEnchantmentEffectArray = (value: unknown): value is EnchantmentEffectRecord[] =>
  Array.isArray(value) && value.every(isEnchantmentEffect);

export const listEnchantments = (): EnchantmentOverviewRow[] =>
  all<EnchantmentOverviewRecord>(
    `SELECT p.id, n.route_path, n.display_label
     FROM enchantment_overview_rows p
     JOIN entity_nodes n
       ON n.entity_type = 'enchantment'
      AND n.entity_id = p.id
      AND n.has_page = 1
     ORDER BY n.display_label, p.id`,
  ).map((row) => ({ id: row.id, name: row.display_label, routePath: row.route_path }));

export const getEnchantmentPresentation = (
  slug: string,
): EnchantmentPresentationRow | undefined => {
  const node = getEntityNodeBySlug("enchantment", slug);
  if (!node) return undefined;
  const row = get<EnchantmentPresentationRecord>(
    `SELECT p.id, p.render_context, p.money_value, p.hide_effect_tooltips,
            p.tooltip_rich_text_json, p.items_json, p.effects_json, n.route_path, n.display_label
     FROM enchantment_presentation_rows p
     JOIN entity_nodes n
       ON n.entity_type = 'enchantment'
      AND n.entity_id = p.id
      AND n.has_page = 1
     WHERE p.id = ?`,
    [node.entityId],
  );
  if (!row) return undefined;
  const description = row.tooltip_rich_text_json
    ? parseGeneratedJson(
        row.tooltip_rich_text_json,
        "enchantment",
        "tooltip_rich_text_json",
        row.id,
        isRichTextDocument,
      )
    : null;
  return {
    id: row.id,
    name: row.display_label,
    renderContext: validateRenderContext(
      row.render_context,
      "enchantment",
      row.id,
      "enchantment-presentation-v1",
    ),
    moneyValue: row.money_value,
    hideEffectTooltips: row.hide_effect_tooltips === 1,
    description,
    appliesToItemRefs: parseGeneratedJson(
      row.items_json,
      "enchantment",
      "items_json",
      row.id,
      isEnchantmentItemRefArray,
    ),
    effects: parseGeneratedJson(
      row.effects_json,
      "enchantment",
      "effects_json",
      row.id,
      isEnchantmentEffectArray,
    ).map(({ tooltipRichText, ...effect }) => ({ ...effect, description: tooltipRichText })),
    routePath: row.route_path,
  };
};
