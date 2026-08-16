import type { Database } from "bun:sqlite";
import type { PipelineDiagnostic } from "../../relationships/relationship-graph.ts";
import { ENTITY_GRAPH_DDL } from "../../relationships/relationship-graph.ts";
import { collectTransitiveDescendants } from "../item/read-models.ts";
import { deriveEntityNodeSlug, prepareEntityNodeWriter } from "../../relationships/entity-nodes.ts";
import { prepareEntityLinkResolver } from "../../relationships/entity-links.ts";
import type { SnapshotRef, MasterTooltipVocabulary } from "../../types.ts";
import {
  translateRichTextV1,
  type RichTextDiagnostic,
  type RichTextV1,
} from "../../rich-text/rich-text-v1.ts";

export const ENCHANTMENT_READ_MODEL_DDL = `
CREATE TABLE enchantment_overview_rows (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  money_value           REAL,
  hide_effect_tooltips  INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE enchantment_presentation_rows (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  render_context        TEXT NOT NULL,
  money_value           REAL NOT NULL,
  hide_effect_tooltips  INTEGER NOT NULL,
  tooltip_source        TEXT,
  tooltip_rich_text_json TEXT,
  items_json            TEXT NOT NULL,
  effects_json          TEXT NOT NULL
);
`;

interface EnchantmentRow {
  id: string;
  enchantment_name: string | null;
  money_value: number | null;
  hide_effect_tooltips: number | null;
  tooltip_source: string | null;
}
interface ItemRow {
  enchantment_id: string;
  item_ordinal: number;
  item_ref_json: string;
}
interface EffectRow {
  enchantment_id: string;
  effect_ordinal: number;
  kind: string;
  status_effect_ref_json: string | null;
  tooltip_source: string | null;
}
interface NodeRow {
  label: string | null;
  has_page: number;
}
interface ItemPresentation {
  itemId: string | null;
  itemLabel: string | null;
  itemRoutePath: string | null;
}
interface EffectPresentation {
  ordinal: number;
  kind: string;
  statusEffectId: string | null;
  statusEffectLabel: string | null;
  statusEffectRoutePath: string | null;
  tooltipSource: string | null;
  tooltipRichText: RichTextV1 | null;
}

export function emitEnchantmentReadModels(
  db: Database,
  routeBase = "/enchantments",
  masterTooltip?: MasterTooltipVocabulary,
): PipelineDiagnostic[] {
  db.exec(ENCHANTMENT_READ_MODEL_DDL);
  db.exec(ENTITY_GRAPH_DDL);
  const overviewInsert = db.prepare(
    `INSERT INTO enchantment_overview_rows (id, name, money_value, hide_effect_tooltips) VALUES (?, ?, ?, ?)`,
  );
  const presentationInsert = db.prepare(
    `INSERT INTO enchantment_presentation_rows (
       id, name, render_context, money_value, hide_effect_tooltips,
       tooltip_source, tooltip_rich_text_json, items_json, effects_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const edgeInsert = db.prepare(
    `INSERT OR IGNORE INTO entity_edges (
       edge_id, source_type, source_id, target_type, target_id, predicate,
       label, weight, evidence_json, anchor
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const writeNode = prepareEntityNodeWriter(db);
  const enchantments = db
    .query<EnchantmentRow, []>(
      `SELECT id, enchantment_name, money_value, hide_effect_tooltips, tooltip_source
     FROM enchantments ORDER BY COALESCE(NULLIF(TRIM(enchantment_name), ''), 'Unnamed enchantment'), id`,
    )
    .all();
  const itemsByEnchantment = new Map<string, ItemRow[]>();
  for (const row of db
    .query<ItemRow, []>(
      `SELECT enchantment_id, item_ordinal, item_ref_json FROM enchantment_items ORDER BY enchantment_id, item_ordinal`,
    )
    .all()) {
    const rows = itemsByEnchantment.get(row.enchantment_id) ?? [];
    rows.push(row);
    itemsByEnchantment.set(row.enchantment_id, rows);
  }
  const effectsByEnchantment = new Map<string, EffectRow[]>();
  for (const row of db
    .query<EffectRow, []>(
      `SELECT enchantment_id, effect_ordinal, kind, status_effect_ref_json, tooltip_source FROM enchantment_effects ORDER BY enchantment_id, effect_ordinal`,
    )
    .all()) {
    const rows = effectsByEnchantment.get(row.enchantment_id) ?? [];
    rows.push(row);
    effectsByEnchantment.set(row.enchantment_id, rows);
  }
  const resolveLink = prepareEntityLinkResolver(db);
  const nodes = new Map<string, NodeRow>();
  for (const node of db
    .query<NodeRow & { entity_type: string; entity_id: string }, []>(
      `SELECT entity_type, entity_id, label, has_page FROM entity_nodes`,
    )
    .all())
    nodes.set(`${node.entity_type}:${node.entity_id}`, node);
  const hasItemsTable = db
    .query<{ name: string }, []>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'items'`,
    )
    .get();
  const itemParentRows = hasItemsTable
    ? db
        .query<{ id: string; parent_ref_json: string | null }, []>(
          `SELECT id, parent_ref_json FROM items`,
        )
        .all()
    : [];
  const parentByItem = new Map<string, string>();
  for (const item of itemParentRows) {
    const parentId = resolveItemRefJson(item.parent_ref_json);
    if (parentId !== null) parentByItem.set(item.id, parentId);
  }
  const publishableItemIds = new Set(
    [...nodes]
      .filter(([key, node]) => key.startsWith("item:") && node.has_page === 1)
      .map(([key]) => key.slice("item:".length)),
  );
  const descendantResolution = collectTransitiveDescendants(parentByItem, publishableItemIds);
  const diagnostics: PipelineDiagnostic[] = [];
  const tx = db.transaction(() => {
    for (const row of enchantments) {
      const name = row.enchantment_name?.trim() || "Unnamed enchantment";
      const tooltip = translateTooltip(row.tooltip_source, masterTooltip);
      for (const diagnostic of tooltip.diagnostics) {
        diagnostics.push({
          severity: diagnostic.severity,
          source: "rich-text",
          code: diagnostic.code,
          message: diagnostic.message,
          entityType: "enchantment",
          entityId: row.id,
          field: "enchantments.tooltip_source",
        });
      }
      overviewInsert.run(row.id, name, row.money_value, row.hide_effect_tooltips ?? 0);
      const slug = deriveEntityNodeSlug(name, row.id);
      writeNode({
        entityType: "enchantment",
        entityId: row.id,
        label: name,
        routePath: `${routeBase}/${slug.canonicalSlug}`,
        canonicalSlug: slug.canonicalSlug,
        shortId: slug.shortId,
      });
      const appliesToItemRefs: ItemPresentation[] = [];
      const emittedEnchantTargets = new Set<string>();
      for (const item of itemsByEnchantment.get(row.id) ?? []) {
        const ref = parseRef(item.item_ref_json);
        const targetId = resolveRef(ref, "item");
        const target = targetId === null ? undefined : nodes.get(`item:${targetId}`);
        if (targetId === null || !target) {
          diagnostics.push(
            unresolvedDiagnostic(
              row.id,
              "item",
              item.item_ref_json,
              "enchantment_items.item_ref_json",
            ),
          );
          continue;
        }
        const targetIds =
          target.has_page === 1
            ? [targetId]
            : (descendantResolution.descendantsByAncestor.get(targetId) ?? []);
        if (target.has_page === 0 && targetIds.length === 0) {
          diagnostics.push({
            severity: "diagnostic",
            source: "enchantment-read-model",
            code: "enchantmentPrototypeHasNoPublishableDescendants",
            message: `Enchantment '${row.id}' targets prototype item '${targetId}', which has no publishable descendants.`,
            entityType: "enchantment",
            entityId: row.id,
            field: "enchantment_items.item_ref_json",
            evidence: { targetId },
          });
          continue;
        }
        for (const resolvedTargetId of targetIds) {
          const resolvedTarget = nodes.get(`item:${resolvedTargetId}`);
          const resolvedLink = resolveLink("item", resolvedTargetId);
          if (!resolvedTarget || resolvedTarget.has_page !== 1 || !resolvedLink) continue;
          if (emittedEnchantTargets.has(resolvedTargetId)) continue;
          emittedEnchantTargets.add(resolvedTargetId);
          edgeInsert.run(
            `${row.id}:enchants:item:${resolvedTargetId}`,
            "enchantment",
            row.id,
            "item",
            resolvedTargetId,
            "enchants",
            "Can enchant",
            1,
            JSON.stringify({
              source: "enchantment_items",
              ordinal: item.item_ordinal,
              whitelistedTarget: targetId,
            }),
            null,
          );
          appliesToItemRefs.push({
            itemId: resolvedTargetId,
            itemLabel: resolvedLink.label,
            itemRoutePath: resolvedLink.routePath,
          });
        }
      }
      const effects: EffectPresentation[] = [];
      for (const effect of effectsByEnchantment.get(row.id) ?? []) {
        const ref = parseRef(effect.status_effect_ref_json);
        const targetId = resolveRef(ref, "status-effect");
        const target = targetId === null ? undefined : nodes.get(`status-effect:${targetId}`);
        if (effect.status_effect_ref_json !== null && (targetId === null || !target))
          diagnostics.push(
            unresolvedDiagnostic(
              row.id,
              "status-effect",
              effect.status_effect_ref_json,
              "enchantment_effects.status_effect_ref_json",
            ),
          );
        else if (targetId !== null && target)
          edgeInsert.run(
            `${row.id}:applies:status-effect:${targetId}`,
            "enchantment",
            row.id,
            "status-effect",
            targetId,
            "applies",
            "Applies",
            1,
            JSON.stringify({
              source: "enchantment_effects",
              ordinal: effect.effect_ordinal,
              kind: effect.kind,
            }),
            null,
          );
        const effectTooltip = translateTooltip(effect.tooltip_source, masterTooltip);
        for (const diagnostic of effectTooltip.diagnostics) {
          diagnostics.push({
            severity: diagnostic.severity,
            source: "rich-text",
            code: diagnostic.code,
            message: diagnostic.message,
            entityType: "enchantment",
            entityId: row.id,
            field: "enchantment_effects.tooltip_source",
          });
        }
        const statusEffectLink =
          targetId === null || !target ? null : resolveLink("status-effect", targetId);
        effects.push({
          ordinal: effect.effect_ordinal,
          kind: effect.kind,
          statusEffectId: targetId,
          statusEffectLabel: statusEffectLink?.label ?? null,
          statusEffectRoutePath: statusEffectLink?.routePath ?? null,
          tooltipSource: effect.tooltip_source,
          tooltipRichText: effectTooltip.document,
        });
      }
      presentationInsert.run(
        row.id,
        name,
        "enchantment-presentation-v1",
        row.money_value ?? 0,
        row.hide_effect_tooltips ?? 0,
        row.tooltip_source,
        tooltip.document === null ? null : JSON.stringify(tooltip.document),
        JSON.stringify(appliesToItemRefs),
        JSON.stringify(effects),
      );
    }
  });
  tx();
  return diagnostics;
}

/**
 * A translated tooltip plus the reasons it may have been withheld.
 *
 * The document and its diagnostics must travel together. Returning a bare null on withholding
 * dropped the diagnostics with it, which hid the text from readers and the reason from
 * maintainers at the same time.
 */
interface TranslatedTooltip {
  document: RichTextV1 | null;
  diagnostics: RichTextDiagnostic[];
}

function translateTooltip(
  source: string | null,
  masterTooltip?: MasterTooltipVocabulary,
): TranslatedTooltip {
  if (source === null) return { document: null, diagnostics: [] };
  const translated = translateRichTextV1(
    source,
    masterTooltip
      ? {
          tooltipCodes: masterTooltip.tooltipCodes,
          tooltipColors: masterTooltip.tooltipColors,
        }
      : {},
  );
  // Prose still holding a template token is not information, so it joins the enchantments
  // whose tooltip is absent and renders as silence. The diagnostics ride along, so the gap
  // stays visible to a maintainer without reaching a reader as "Crit Chance by {1}".
  const withhold = translated.diagnostics.some((entry) => entry.code === "unfilledTooltipVariable");
  return { document: withhold ? null : translated, diagnostics: translated.diagnostics };
}

function resolveItemRefJson(value: string | null): string | null {
  if (value === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const ref = parsed as Partial<SnapshotRef>;
  if (ref.kind === "lookupAsset" && typeof ref.guid === "string") return ref.guid;
  if (ref.kind === "namedAsset" && ref.entity === "item" && typeof ref.name === "string") {
    return `named;item;${ref.name}`;
  }
  return null;
}

function parseRef(value: string | null): SnapshotRef | null {
  if (value === null) return null;
  try {
    const ref = JSON.parse(value) as SnapshotRef;
    return typeof ref === "object" && ref !== null && typeof ref.kind === "string" ? ref : null;
  } catch {
    return null;
  }
}
function resolveRef(ref: SnapshotRef | null, entity: string): string | null {
  if (!ref) return null;
  if (ref.kind === "lookupAsset") return ref.guid;
  if (ref.kind === "namedAsset" && ref.entity === entity) return `named;${entity};${ref.name}`;
  return null;
}
function unresolvedDiagnostic(
  enchantmentId: string,
  targetType: string,
  value: string,
  field: string,
): PipelineDiagnostic {
  return {
    severity: "diagnostic",
    source: "enchantment-read-model",
    code: "enchantmentReferenceUnresolved",
    message: `Enchantment '${enchantmentId}' has an unresolvable ${targetType} reference.`,
    entityType: "enchantment",
    entityId: enchantmentId,
    field,
    evidence: { reference: value },
  };
}
