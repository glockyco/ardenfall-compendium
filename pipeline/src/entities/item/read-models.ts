import type { Database } from "bun:sqlite";
import type { LoadDescriptorsOutput } from "../../stages/load-descriptors.ts";
import type {
  MasterTooltipVocabulary,
  SnapshotEnvelope,
  SnapshotItemIconMetadata,
  SnapshotRef,
} from "../../types.ts";
import { translateRichTextV1 } from "../../rich-text/rich-text-v1.ts";
import {
  ENTITY_GRAPH_DDL,
  insertPipelineDiagnostics,
} from "../../relationships/relationship-graph.ts";
import {
  disambiguateLabels,
  emitRelationshipSections,
} from "../../relationships/relationship-sections.ts";
import type { RichTextNode } from "../../rich-text/rich-text-v1.ts";
import { deriveShortId, deriveSlug } from "../../slug/derive-slug.ts";

const ITEM_EFFECT_SOURCES = new Set([
  "spellDataJson",
  "secondarySpellDataJson",
  "statusEffectsJson",
  "areaOfEffectJson",
  "bleedStatusEffectJson",
]);

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
  value                       INTEGER,
  weight                      REAL,
  diagnostics_json           TEXT NOT NULL,
  name_is_placeholder        INTEGER NOT NULL
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

export function resolveItemDisplayLabel(
  itemName: string | null | undefined,
  presentationName: string | null,
  variantLabel: string,
): { label: string; isPlaceholder: boolean } {
  const value = (presentationName ?? itemName)?.trim() ?? "";
  const isPlaceholder = isPlaceholderItemName(value);
  return {
    label: isPlaceholder ? `Unnamed item — ${variantLabel}` : value,
    isPlaceholder,
  };
}

export function isPlaceholderItemName(value: string | null | undefined): boolean {
  const trimmed = value?.trim() ?? "";
  // The authors mark a prototype by writing base or placeholder into its name, and they
  // put the marker wherever it reads best: BASE ARMOR, Blunt BASE, Longbow base, Auto Base.
  // Anchoring to the start missed eleven of them. Measured against all 1,273 items, the
  // standalone word matches only prototypes, every one of which has between 1 and 62
  // descendants, so there is no real item this catches by accident.
  return (
    trimmed.length === 0 || /\b(?:base|placeholder)\b/i.test(trimmed) || /\{[^{}]+\}/.test(trimmed)
  );
}

export interface EntityNodeInput {
  entityType: string;
  entityId: string;
  label: string | null;
  routePath: string | null;
  canonicalSlug?: string;
  shortId?: string;
  hasPage?: boolean;
}

interface ItemMetadata {
  variantId: string;
  variantLabel: string;
  label: string;
  isPlaceholder: boolean;
  hasPage: boolean;
  parentRefJson: string | null;
}

export type EntityNodeWriter = (node: EntityNodeInput) => void;

export function prepareEntityNodeWriter(db: Database): EntityNodeWriter {
  const insert = db.prepare(
    `INSERT INTO entity_nodes (entity_type, entity_id, label, display_label, route_path, canonical_slug, short_id, has_page) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(entity_type, entity_id) DO NOTHING`,
  );

  return (node) => {
    const explicitCanonicalSlug = node.canonicalSlug;
    const explicitShortId = node.shortId;
    if ((explicitCanonicalSlug === undefined) !== (explicitShortId === undefined)) {
      throw new Error("entity node canonicalSlug and shortId must be provided together");
    }

    const slug =
      explicitCanonicalSlug === undefined
        ? deriveEntityNodeSlug(node.label ?? "", node.entityId)
        : { canonicalSlug: explicitCanonicalSlug, shortId: explicitShortId as string };
    insert.run(
      node.entityType,
      node.entityId,
      node.label,
      node.label,
      node.routePath,
      slug.canonicalSlug,
      slug.shortId,
      (node.hasPage ?? true) ? 1 : 0,
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
  if (!itemEnvelope) {
    throw new Error("emitItemReadModels: missing item envelope for item presentation rows");
  }
  const itemById = new Map(
    (
      db
        .query(
          'SELECT id, name, variant, "categoryRef" AS category_ref, parent_ref_json FROM items',
        )
        .all() as {
        id: string;
        name: string | null;
        variant: string | null;
        category_ref: string | null;
        parent_ref_json: string | null;
      }[]
    ).map((row) => [row.id, row] as const),
  );
  const itemMetadata = new Map<string, ItemMetadata>();
  for (const snapshotRow of itemEnvelope.rows) {
    const item = itemById.get(snapshotRow.id);
    const variantId = item?.variant ?? snapshotRow.variant;
    if (!variantId) throw new Error(`Item '${snapshotRow.id}' is missing a variant`);
    const variant = desc.variants.item?.find((candidate) => candidate.variantId === variantId);
    const variantLabel = variant?.label ?? titleCase(variantId);
    const presentationName = snapshotRow.presentation?.displayName ?? null;
    const displayLabel = resolveItemDisplayLabel(item?.name, presentationName, variantLabel);
    itemMetadata.set(snapshotRow.id, {
      variantId,
      variantLabel,
      label: displayLabel.label,
      isPlaceholder: displayLabel.isPlaceholder,
      hasPage: !displayLabel.isPlaceholder,
      parentRefJson: item?.parent_ref_json ?? null,
    });
  }
  const prototypeDiagnostics: Parameters<typeof insertPipelineDiagnostics>[1] = [];
  for (const [itemId, metadata] of itemMetadata) {
    if (!metadata.isPlaceholder) continue;
    prototypeDiagnostics.push({
      severity: "diagnostic",
      source: "item-presentation-read-model",
      code: "itemNamePlaceholder",
      message: `Item '${itemId}' has a prototype name and no public page: '${metadata.label}'.`,
      entityType: "item",
      entityId: itemId,
      field: "presentation.displayName",
      evidence: { label: metadata.label, variant: metadata.variantId },
    });
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
  const publishedOverviewSource = overviewSource.filter(
    (row) => itemMetadata.get(row.id)?.hasPage === true,
  );
  for (const row of publishedOverviewSource) {
    overviewInsert.run(
      row.id,
      itemMetadata.get(row.id)?.label ?? row.name,
      row.weight,
      row.value,
      row.variant,
      row.display_icon_hash,
      colorByItem.get(row.id) ?? null,
    );
  }
  const categories = new Map<string, { label: string; count: number }>();
  for (const row of publishedOverviewSource) {
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

  const displayIconByItem = new Map<string, string | null>();
  for (const row of db
    .query(
      `SELECT entity_row_id, asset_hash FROM asset_refs WHERE entity_id = 'item' AND slot = 'displayIcon' AND asset_kind = 'image'`,
    )
    .all() as { entity_row_id: string; asset_hash: string }[]) {
    displayIconByItem.set(row.entity_row_id, row.asset_hash);
  }
  const pageCategoryIds = new Set(
    db
      .query<{ id: string }, []>("SELECT id FROM item_categories")
      .all()
      .map((row) => row.id),
  );
  const pageTagIds = new Set(
    db
      .query<{ id: string }, []>("SELECT id FROM item_tags")
      .all()
      .map((row) => row.id),
  );
  const tagsByItem = new Map<string, string[]>();
  for (const row of db
    .query<{ item_id: string; tag: string }, []>(
      "SELECT item_id, tag FROM item_tag_refs ORDER BY item_id, tag",
    )
    .all()) {
    const tags = tagsByItem.get(row.item_id) ?? [];
    tags.push(row.tag);
    tagsByItem.set(row.item_id, tags);
  }
  const statusEffectIds = new Set<string>();
  const hasStatusEffectsTable = db
    .query<{ name: string }, []>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'status_effects'`,
    )
    .get();
  if (hasStatusEffectsTable) {
    for (const row of db.query<{ id: string }, []>(`SELECT id FROM status_effects`).all()) {
      statusEffectIds.add(row.id);
    }
  }
  const spellIds = new Set<string>();
  const hasSpellsTable = db
    .query<{ name: string }, []>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'spells'`,
    )
    .get();
  if (hasSpellsTable) {
    for (const row of db.query<{ id: string }, []>(`SELECT id FROM spells`).all()) {
      spellIds.add(row.id);
    }
  }

  const presentationInsert = db.prepare(
    `INSERT INTO item_presentation_rows (
      id, name, variant, item_type, render_context, display_icon_hash, display_icon_color,
      description_source, description_rich_text_json, effects_source, effects_source_rich_text_json,
      effect_facts_json, stat_rows_json, requirements_json, durability_json, state_facts_json,
      value, weight, diagnostics_json, name_is_placeholder
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const writeNode = prepareEntityNodeWriter(db);
  const aliasInsert = db.prepare(
    `INSERT OR IGNORE INTO entity_aliases (alias_key, target_type, target_id, label, source) VALUES (?, ?, ?, ?, ?)`,
  );
  const edgeInsert = db.prepare(
    `INSERT OR IGNORE INTO entity_edges (edge_id, source_type, source_id, target_type, target_id, predicate, label, weight, evidence_json, anchor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const richTextDiagnostics: Parameters<typeof insertPipelineDiagnostics>[1] = [];
  const emitTaxonomyEdges = (
    itemId: string,
    categoryRef: string | null | undefined,
    tagIds: string[],
  ) => {
    if (itemMetadata.get(itemId)?.isPlaceholder) return;
    for (const tagId of tagIds) {
      if (!pageTagIds.has(tagId)) {
        richTextDiagnostics.push({
          severity: "diagnostic",
          source: "relationship-graph",
          code: "itemTagUnresolved",
          message: `Item '${itemId}' has an unresolvable tag reference '${tagId}'.`,
          entityType: "item",
          entityId: itemId,
          field: "item_tag_refs.tag",
          evidence: { tagId },
        });
        continue;
      }
      edgeInsert.run(
        `${itemId}:tagged:item-tag:${tagId}`,
        "item",
        itemId,
        "item-tag",
        tagId,
        "tagged",
        "Tagged",
        1,
        JSON.stringify({ source: "items.tags" }),
        null,
      );
    }
    if (categoryRef === null || categoryRef === undefined) return;
    const categoryId = resolveNamedAssetId(categoryRef, pageCategoryIds);
    if (categoryId === null) {
      richTextDiagnostics.push({
        severity: "diagnostic",
        source: "relationship-graph",
        code: "itemCategoryUnresolved",
        message: `Item '${itemId}' has an unresolvable category reference.`,
        entityType: "item",
        entityId: itemId,
        field: "items.categoryRef",
        evidence: { categoryRef },
      });
      return;
    }
    edgeInsert.run(
      `${itemId}:categorised_as:item-category:${categoryId}`,
      "item",
      itemId,
      "item-category",
      categoryId,
      "categorised_as",
      "Category",
      1,
      JSON.stringify({ source: "items.categoryRef" }),
      null,
    );
  };
  const tx = db.transaction(() => {
    for (const snapshotRow of itemEnvelope.rows) {
      const item = itemById.get(snapshotRow.id);
      const metadata = itemMetadata.get(snapshotRow.id);
      if (!metadata) throw new Error(`Item '${snapshotRow.id}' has no resolved metadata`);
      const sourceHasPage = metadata.hasPage;
      emitTaxonomyEdges(snapshotRow.id, item?.category_ref, tagsByItem.get(snapshotRow.id) ?? []);
      const presentation = snapshotRow.presentation;
      if (!presentation) continue;
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
          targetHasPage: true,
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
          targetHasPage: true,
        }),
      });
      const displayLabel = resolveItemDisplayLabel(
        item?.name,
        presentation.displayName,
        metadata.variantLabel,
      );
      const itemLabel = displayLabel.label;
      const variantId = metadata.variantId;
      const rawEffectFacts = presentation.effects.map((effect) => {
        // An unrecognised source means we have no reader-facing word for the role, not that
        // the relationship is false. The edge is still emitted, so a spell page keeps listing
        // the items that cast it, and the diagnostic names the value that needs a phrase.
        const effectSourceRecognised = ITEM_EFFECT_SOURCES.has(effect.source);
        if (!effectSourceRecognised) {
          richTextDiagnostics.push({
            severity: "diagnostic",
            source: "item-presentation-read-model",
            code: "itemEffectSourceUnknown",
            message: `Item '${snapshotRow.id}' has an unrecognised effect source '${effect.source}'.`,
            entityType: "item",
            entityId: snapshotRow.id,
            field: "presentation.effects.source",
            evidence: { source: effect.source },
          });
        }
        if (effect.targetType === "status-effect") {
          const targetId = resolveStatusEffectId(effect.targetRef, statusEffectIds);
          if (targetId === null) {
            richTextDiagnostics.push({
              severity: "diagnostic",
              source: "item-presentation-read-model",
              code: "itemStatusEffectUnresolved",
              message: `Effect '${effect.label}' does not resolve to a published status effect.`,
              entityType: "item",
              entityId: snapshotRow.id,
              field: "presentation.effects.targetRef",
              evidence: { targetRef: effect.targetRef ?? null },
            });
            return { ...effect, targetId: null };
          }
          if (sourceHasPage) {
            edgeInsert.run(
              `${snapshotRow.id}:applies:status-effect:${targetId}`,
              "item",
              snapshotRow.id,
              "status-effect",
              targetId,
              "applies",
              "Applies",
              1,
              JSON.stringify({ source: effect.source, level: effect.level ?? null }),
              null,
            );
          }
          return { ...effect, targetId };
        }
        if (effect.targetType !== "spell") return effect;
        const targetId = resolveSpellId(effect.targetRef, spellIds);
        if (targetId === null) {
          richTextDiagnostics.push({
            severity: "diagnostic",
            source: "item-presentation-read-model",
            code: "itemSpellUnresolved",
            message: `Effect '${effect.label}' does not resolve to a published spell.`,
            entityType: "item",
            entityId: snapshotRow.id,
            field: "presentation.effects.targetRef",
            evidence: { targetRef: effect.targetRef ?? null },
          });
          return { ...effect, targetId: null };
        }
        if (sourceHasPage) {
          edgeInsert.run(
            `${snapshotRow.id}:casts:spell:${targetId}`,
            "item",
            snapshotRow.id,
            "spell",
            targetId,
            "casts",
            "Casts",
            1,
            JSON.stringify({ source: effect.source, level: effect.level ?? null }),
            null,
          );
        }
        return { ...effect, targetId };
      });
      const labelledEffectFacts = rawEffectFacts.map((effect) => ({
        ...effect,
        // A short id is a pure function of the target id, so it is derived rather than read
        // from entity_nodes. Item read models run before spells and status effects publish
        // their nodes, so a table read here would find nothing and silently skip the
        // disambiguation that two identically named targets need.
        shortId: effect.targetId === null ? "" : deriveShortId(effect.targetId),
      }));
      disambiguateLabels(labelledEffectFacts);
      const effectFacts = labelledEffectFacts.map(({ shortId: _shortId, ...effect }) => effect);
      writeNode({
        entityType: "item",
        entityId: snapshotRow.id,
        label: itemLabel,
        routePath: sourceHasPage ? `${itemRoute}/${snapshotRow.id}` : null,
        hasPage: sourceHasPage,
      });
      aliasInsert.run(aliasKey(itemLabel), "item", snapshotRow.id, itemLabel, "item-presentation");
      presentationInsert.run(
        snapshotRow.id,
        itemLabel,
        metadata.variantId,
        presentation.itemType,
        presentation.renderContext,
        displayIconByItem.get(snapshotRow.id) ?? null,
        colorByItem.get(snapshotRow.id) ?? null,
        presentation.descriptionSource,
        JSON.stringify(description),
        presentation.effectsSource,
        JSON.stringify(effectsSource),
        JSON.stringify(effectFacts),
        JSON.stringify(presentation.statRows),
        JSON.stringify(presentation.requirements),
        presentation.durability ? JSON.stringify(presentation.durability) : null,
        JSON.stringify(presentation.stateFacts),
        presentation.value,
        presentation.weight,
        JSON.stringify([
          ...presentation.diagnostics,
          ...description.diagnostics,
          ...effectsSource.diagnostics,
        ]),
        metadata.isPlaceholder ? 1 : 0,
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

      const variantLabel = metadata.variantLabel;
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
      if (sourceHasPage) {
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
      }

      for (const term of sourceHasPage ? collectTermLinks(description.nodes) : []) {
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
        if (sourceHasPage) {
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
        }
      }
    }
  });
  tx();

  const parentByChild = new Map<string, string>();
  for (const [itemId, metadata] of itemMetadata) {
    const parentId = resolveItemRefJson(metadata.parentRefJson);
    if (parentId === null) {
      if (metadata.parentRefJson !== null && !isMissingParentRefJson(metadata.parentRefJson)) {
        richTextDiagnostics.push({
          severity: "diagnostic",
          source: "item-presentation-read-model",
          code: "itemParentReferenceUnresolved",
          message: `Item '${itemId}' has an invalid parent reference.`,
          entityType: "item",
          entityId: itemId,
          field: "items.parent_ref_json",
          evidence: { parentRefJson: metadata.parentRefJson },
        });
      }
      continue;
    }
    if (!itemMetadata.has(parentId)) {
      richTextDiagnostics.push({
        severity: "diagnostic",
        source: "item-presentation-read-model",
        code: "itemParentReferenceUnresolved",
        message: `Item '${itemId}' has an unresolvable parent reference '${parentId}'.`,
        entityType: "item",
        entityId: itemId,
        field: "items.parent_ref_json",
        evidence: { parentId },
      });
      continue;
    }
    parentByChild.set(itemId, parentId);
  }
  const descendants = collectTransitiveDescendants(
    parentByChild,
    new Set([...itemMetadata].filter(([, metadata]) => !metadata.isPlaceholder).map(([id]) => id)),
  );
  for (const cycle of descendants.cycles) {
    richTextDiagnostics.push({
      severity: "diagnostic",
      source: "item-presentation-read-model",
      code: "itemParentCycle",
      message: `Items '${cycle.join("', '")}' form a parent cycle.`,
      entityType: "item",
      entityId: cycle[0] ?? null,
      field: "items.parent_ref_json",
      evidence: { cycle },
    });
  }
  for (const [itemId, parentId] of parentByChild) {
    const child = itemMetadata.get(itemId);
    const parent = itemMetadata.get(parentId);
    if (!child || !parent || child.isPlaceholder || parent.isPlaceholder) continue;
    edgeInsert.run(
      `${itemId}:derives_from:item:${parentId}`,
      "item",
      itemId,
      "item",
      parentId,
      "derives_from",
      "Derives from",
      1,
      JSON.stringify({ source: "items.parent_ref_json" }),
      null,
    );
  }
  richTextDiagnostics.unshift(...prototypeDiagnostics);
  emitRelationshipSections(db);
  insertPipelineDiagnostics(db, richTextDiagnostics, "item-presentation-read-model");
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

function isMissingParentRefJson(value: string): boolean {
  try {
    const parsed = JSON.parse(value) as { kind?: unknown };
    return typeof parsed === "object" && parsed !== null && parsed.kind === "missing";
  } catch {
    return false;
  }
}

export interface DescendantResolution {
  descendantsByAncestor: Map<string, string[]>;
  cycles: string[][];
}

export function collectTransitiveDescendants(
  parentByChild: ReadonlyMap<string, string>,
  publishableIds: ReadonlySet<string>,
): DescendantResolution {
  const childrenByParent = new Map<string, string[]>();
  for (const [child, parent] of parentByChild) {
    const children = childrenByParent.get(parent) ?? [];
    children.push(child);
    childrenByParent.set(parent, children);
  }
  for (const children of childrenByParent.values()) children.sort();
  const descendantsByAncestor = new Map<string, string[]>();
  const cycleKeys = new Set<string>();
  const cycles: string[][] = [];
  const ancestors = new Set([...childrenByParent.keys(), ...parentByChild.keys()]);
  for (const ancestor of ancestors) {
    const descendants = new Set<string>();
    const visiting = new Set<string>([ancestor]);
    const visited = new Set<string>();
    const walk = (parent: string): void => {
      for (const child of childrenByParent.get(parent) ?? []) {
        if (visiting.has(child)) {
          const cycle = [...visiting, child].sort();
          const key = cycle.join("|");
          if (!cycleKeys.has(key)) {
            cycleKeys.add(key);
            cycles.push(cycle);
          }
          continue;
        }
        if (visited.has(child)) continue;
        visited.add(child);
        if (publishableIds.has(child)) descendants.add(child);
        visiting.add(child);
        walk(child);
        visiting.delete(child);
      }
    };
    walk(ancestor);
    descendantsByAncestor.set(ancestor, [...descendants].sort());
  }
  return { descendantsByAncestor, cycles };
}

function resolveStatusEffectId(
  targetRef: SnapshotRef | null | undefined,
  statusEffectIds: Set<string>,
): string | null {
  if (targetRef?.kind !== "lookupAsset" || !targetRef.guid) return null;
  return statusEffectIds.has(targetRef.guid) ? targetRef.guid : null;
}
function resolveSpellId(
  targetRef: SnapshotRef | null | undefined,
  spellIds: Set<string>,
): string | null {
  return resolveNamedAssetId(targetRef, spellIds);
}

export function resolveNamedAssetId(value: unknown, pageIds: ReadonlySet<string>): string | null {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed) as unknown;
    } catch {
      return null;
    }
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const ref = parsed as { kind?: unknown; entity?: unknown; name?: unknown };
  if (ref.kind !== "namedAsset" || typeof ref.entity !== "string" || typeof ref.name !== "string") {
    return null;
  }
  const targetId = `named;${ref.entity};${ref.name}`;
  return pageIds.has(targetId) ? targetId : null;
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
