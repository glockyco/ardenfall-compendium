import { all, get } from "../db";
import { isRecord, parseGeneratedJson, validateRenderContext } from "../json";
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

export interface EnchantmentEffect {
  ordinal: number;
  kind: string;
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
const isEnchantmentEffect = (value: unknown): value is EnchantmentEffect =>
  isRecord(value) &&
  typeof value.ordinal === "number" &&
  Number.isInteger(value.ordinal) &&
  typeof value.kind === "string" &&
  isNullableString(value.statusEffectId) &&
  isNullableString(value.statusEffectLabel) &&
  isNullableString(value.statusEffectRoutePath);
const isEnchantmentEffectArray = (value: unknown): value is EnchantmentEffect[] =>
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
            p.items_json, p.effects_json, n.route_path, n.display_label
     FROM enchantment_presentation_rows p
     JOIN entity_nodes n
       ON n.entity_type = 'enchantment'
      AND n.entity_id = p.id
      AND n.has_page = 1
     WHERE p.id = ?`,
    [node.entityId],
  );
  if (!row) return undefined;
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
    ),
    routePath: row.route_path,
  };
};
