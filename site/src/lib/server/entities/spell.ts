import { disambiguateLabels } from "../disambiguate-labels";
import { all, get } from "../db";
import { isRecord, isRichTextDocument, parseGeneratedJson, validateRenderContext } from "../json";
import type { RichTextDocument } from "./item";
import { getEntityNodeBySlug } from "./item";

interface SpellOverviewRecord {
  id: string;
  name: string;
  skill: string | null;
  mana_cost: number | null;
  is_illegal: number;
  route_path: string;
  short_id: string;
}

interface SpellEffectRecord {
  kind: string;
  statusEffectId: string | null;
  statusEffectLabel: string | null;
  statusEffectRoutePath: string | null;
  sampleLevel: number | null;
  sampleLifetimeSeconds: number | null;
  appliesToSelf: boolean | null;
  damage: number | null;
  damageType: string | null;
}

const isNullableNumber = (value: unknown): value is number | null =>
  value === null || (typeof value === "number" && Number.isFinite(value));
const isNullableBoolean = (value: unknown): value is boolean | null =>
  value === null || typeof value === "boolean";
const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === "string";
const isSpellEffectArray = (value: unknown): value is SpellEffectRecord[] =>
  Array.isArray(value) &&
  value.every(
    (effect) =>
      isRecord(effect) &&
      typeof effect.kind === "string" &&
      isNullableString(effect.statusEffectId) &&
      isNullableString(effect.statusEffectLabel) &&
      isNullableString(effect.statusEffectRoutePath) &&
      isNullableNumber(effect.sampleLevel) &&
      isNullableNumber(effect.sampleLifetimeSeconds) &&
      isNullableBoolean(effect.appliesToSelf) &&
      isNullableNumber(effect.damage) &&
      isNullableString(effect.damageType),
  );

interface SpellPresentationRecord {
  id: string;
  name: string;
  render_context: string;
  skill: string | null;
  mana_cost: number | null;
  is_illegal: number;
  tooltip_rich_text_json: string | null;
  effects_json: string;
  /** Joined from the governing skill's node with a page, null when the spell has none. */
  skill_route_path: string | null;
  route_path: string;
}

export interface SpellOverviewRow {
  id: string;
  name: string;
  skill: string | null;
  manaCost: number | null;
  isIllegal: boolean;
  routePath: string;
}

export interface SpellPresentationEffect {
  kind: string;
  statusEffectId: string | null;
  statusEffectLabel: string | null;
  statusEffectRoutePath: string | null;
  sampleLevel: number | null;
  sampleLifetimeSeconds: number | null;
  appliesToSelf: boolean | null;
  damage: number | null;
  damageType: string | null;
}

export interface SpellPresentationRow {
  id: string;
  name: string;
  renderContext: "spell-presentation-v1";
  skill: string | null;
  skillRoutePath: string | null;
  manaCost: number | null;
  isIllegal: boolean;
  description: RichTextDocument | null;
  descriptionText: string | null;
  effects: SpellPresentationEffect[];
  routePath: string;
}

export const listSpells = (): SpellOverviewRow[] => {
  const rows = all<SpellOverviewRecord>(
    `SELECT o.id, o.name, o.skill, o.mana_cost, o.is_illegal, n.route_path, n.short_id
     FROM spell_overview_rows o
     JOIN entity_nodes n
       ON n.entity_type = 'spell'
      AND n.entity_id = o.id
      AND n.has_page = 1
     ORDER BY o.name`,
  ).map((row) => ({
    id: row.id,
    name: row.name,
    skill: row.skill,
    manaCost: row.mana_cost,
    isIllegal: row.is_illegal === 1,
    routePath: row.route_path,
    shortId: row.short_id,
  }));
  return disambiguateLabels(rows, "name", (row) => row.shortId).map(
    ({ shortId: _shortId, ...row }) => row,
  );
};

export const getSpellPresentation = (slug: string): SpellPresentationRow | undefined => {
  const node = getEntityNodeBySlug("spell", slug);
  if (!node) return undefined;
  const row = get<SpellPresentationRecord>(
    `SELECT p.id, p.name, p.render_context, p.skill, p.mana_cost, p.is_illegal,
            p.tooltip_rich_text_json,
            p.effects_json,
            sn.route_path AS skill_route_path,
            n.route_path
     FROM spell_presentation_rows p
     LEFT JOIN entity_nodes sn
       ON sn.entity_type = 'stat-type'
      AND sn.entity_id = p.skill_id
      AND sn.has_page = 1
     JOIN entity_nodes n
       ON n.entity_type = 'spell'
      AND n.entity_id = p.id
      AND n.has_page = 1
     WHERE p.id = ?`,
    [node.entityId],
  );
  if (!row) return undefined;
  const effects = disambiguateSpellEffectLabels(
    parseGeneratedJson(row.effects_json, "spell", "effects_json", row.id, isSpellEffectArray),
  );
  const description = row.tooltip_rich_text_json
    ? parseGeneratedJson(
        row.tooltip_rich_text_json,
        "spell",
        "tooltip_rich_text_json",
        row.id,
        isRichTextDocument,
      )
    : null;
  return {
    id: row.id,
    name: row.name,
    renderContext: validateRenderContext(
      row.render_context,
      "spell",
      row.id,
      "spell-presentation-v1",
    ),
    skill: row.skill,
    skillRoutePath: row.skill_route_path,
    manaCost: row.mana_cost,
    isIllegal: row.is_illegal === 1,
    description,
    descriptionText: description ? richTextPlainText(description) : null,
    effects,
    routePath: row.route_path,
  };
};

function disambiguateSpellEffectLabels(effects: SpellEffectRecord[]): SpellEffectRecord[] {
  const labelled = effects.flatMap((effect, index) =>
    effect.statusEffectLabel === null
      ? []
      : [{ ...effect, effectIndex: index, statusEffectLabel: effect.statusEffectLabel }],
  );
  const disambiguated = disambiguateLabels(
    labelled,
    "statusEffectLabel",
    (effect) => effect.statusEffectRoutePath?.split("--").pop() ?? effect.statusEffectId ?? "",
  );
  const labels = new Map(
    disambiguated.map((effect) => [effect.effectIndex, effect.statusEffectLabel]),
  );
  return effects.map((effect, index) => ({
    ...effect,
    statusEffectLabel: labels.get(index) ?? effect.statusEffectLabel,
  }));
}
function richTextPlainText(document: RichTextDocument): string {
  const visit = (node: RichTextDocument["nodes"][number]): string => {
    if (node.type === "text") return node.text;
    if (node.type === "lineBreak") return " ";
    if (node.type === "sprite") return node.name;
    if (node.type === "termLink") return node.label;
    return node.children.map(visit).join("");
  };
  return document.nodes.map(visit).join("").replace(/\s+/g, " ").trim();
}
