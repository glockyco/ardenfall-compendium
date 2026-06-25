---
title: "Item Presentation Depth Design"
type: spec
status: implemented
created: 2026-05-19
parent:
superseded_by:
archived: 2026-06-25
---

# Item Presentation Depth Design

**Date:** 2026-05-19  
**Status:** Draft design for user review before implementation planning  
**Game version context:** Ardenfall Demo `0.0.10.91`  
**Primary inputs:**

- `docs/superpowers/specs/2026-05-14-item-icon-tooltip-audit.md`
- `docs/superpowers/specs/2026-05-15-tooltip-and-ui-surface-audit.md`
- `docs/superpowers/specs/2026-04-29-ardenfall-compendium-implementation-decisions.md`
- `docs/superpowers/roadmap.md` Slice 4

## Purpose

Slice 4 turns item pages from generic field lists into robust compendium presentation. It must preserve the static-assets-first architecture while adding:

1. a deterministic item presentation contract;
2. safe rich-text rendering for game/TMP tooltip strings;
3. typed item stats, requirements, effects, and state facts;
4. generated cross-linking infrastructure;
5. a small, discoverable frontend component layer that prevents route-local UI drift.

This is not a CSS polish slice. It defines the contracts future item, spell, status-effect, quest, recipe, vendor, monster, and map pages will depend on.

## Source-grounded principles

The decompiled game item panel is assembled by `UI/ItemInfoListUI.cs` from live item behavior: `GetFullItemName()`, `GetTooltipDescription()`, `GetEffectsTooltip()`, `GetTooltipItemType()`, `GetItemStatInfos()`, durability interfaces, inventory value calculation, minimum stat checks, stolen state, and equipped-item comparison. Item behavior then fans into status effects, spells, enchantments, potion recipes, master tooltip codes, and player/inventory state.

The compendium therefore cannot safely use either extreme:

- raw behavior strings only: preserves wording but hides facts inside unsafe markup and makes links/filtering impossible;
- structured fields only: safer and queryable, but misses game behavior encoded in tooltip methods.

The selected design is a hybrid: export deterministic no-player presentation fragments and structured facts, translate rich text in the pipeline, and render only typed nodes on the site.

Wiki and design-system research from the audit adds two more principles:

- cross-links are infrastructure, not incidental `<a>` tags;
- UI consistency must be encoded through tokens, owned components, examples, and catalog metadata, not taste.

## Approaches considered

### Approach A — route-local rendering over current `fields_json`

Keep the mod and pipeline mostly unchanged. Teach `/items/[id]` to inspect `fields_json` and render nicer sections.

This is rejected. It would reproduce the Ancient Kingdoms failure mode: each page author would decide which fields mean stats, effects, links, and state. It also keeps cross-links trapped in page code and makes tooltip/read-model parity fragile.

### Approach B — behavior-rendered tooltip strings as final output

Have the mod call game methods, store tooltip strings, and let Svelte render sanitized HTML.

This is rejected as the primary contract. It preserves wording, but gameplay facts would exist only inside prose, link targets would be inferred late, and `{@html}`/HTML sanitization would become a load-bearing security boundary. It also does not solve player-state-dependent branches such as equipped comparison, learned recipe state, current durability, merchant prices, or stolen ownership.

### Approach C — hybrid presentation/read-model contract

Add explicit item presentation DTOs/read models, retain behavior-rendered TMP source strings for wording and drift diagnostics, derive structured stats/requirements/effects/relationships from audited data, translate TMP into `rich_text_v1` in the pipeline, and render typed components in Svelte.

This is selected. It is more work than a field-list restyle, but it keeps stable facts queryable, makes cross-linking first-class, preserves source wording, and gives later entity slices a reusable contract.

## Slice scope

### Include

- Item presentation snapshot/read model for detail pages and item-link hover/focus cards.
- Deterministic `item-presentation-v1` render context.
- Pipeline `rich_text_v1` translator and diagnostics for the TMP subset encountered by item names, descriptions, effects, requirements, and tooltip-code text.
- Base/local item stat rows without equipped-item comparison deltas.
- Requirements as static facts, not pass/fail player-state messages.
- Item type, description, effects, value, weight, icon/color, durability applicability/max values, and state notes.
- Narrow support data needed to resolve item effect references: status-effect, spell, enchantment, master tooltip-code/color, and sprite/icon references, or explicit unresolved-reference diagnostics.
- Relationship graph foundation: canonical nodes, aliases, redirects/disambiguation records, typed edges, relationship sections, and link audit.
- Item overview filtering/sorting using generated item facts, progressive-enhanced URL state, and curated crawlable static category pages only.
- UI architecture foundation: tokens, layout/domain component layers, component catalog, component intake gate, and initial item presentation components.
- Diagnostics for unsupported rich-text, tooltip, state, and link features.

### Defer

- Player/build simulator.
- Equipped-item comparison deltas as default tooltip behavior.
- Current durability percentages, broken/ruined instance state, and item-instance condition.
- Learned/unlearned potion recipe state.
- Merchant buy/sell price breakdowns, affordability, training, repair, and barter state.
- Full status-effect, spell, enchantment, recipe, quest, vendor, monster, note/book, map, or location entity pages unless a narrow support table is required to render item presentation safely.
- Sitewide graph visualization.
- Full Storybook or visual-regression service; start with metadata plus a static/dev component gallery.

## Architecture

The data flow remains one-way:

```text
Ardenfall runtime
  -> BepInEx snapshot DTOs
  -> Bun pipeline canonical tables + presentation/link read models
  -> SQLite + WebP artifact
  -> SvelteKit prerendered pages/components
```

No layer reaches backward:

- the mod emits explicit DTOs and diagnostics only;
- the pipeline validates, translates, links, canonicalises, and emits SQLite/read models;
- SvelteKit route loaders read `site_*`, item presentation, and relationship read models through `site/src/lib/server/read-models.ts`;
- Svelte components receive typed props and never open SQLite, parse descriptors, or parse raw game markup.

## Deterministic item presentation context

Slice 4 defines a versioned context:

```json
{
  "id": "item-presentation-v1",
  "player": null,
  "inventory": null,
  "equippedComparison": null,
  "ownership": "canonical",
  "durability": "max-fact-only",
  "merchant": null,
  "training": null,
  "repair": null,
  "recipeKnowledge": null,
  "hoverSideEffects": false
}
```

Rules:

- Do not create a fake player, fake inventory, fake equipped item, fake merchant, or fake learned-recipe manager to make game UI methods return convenient text.
- Stable item facts render normally.
- Player-state-only branches emit omission diagnostics and, where useful, explanatory page copy.
- The context id is stored in snapshot presentation data, SQLite presentation rows, and artifact diagnostics so future context changes are visible.

## Mod snapshot additions

The current item snapshot row shape is:

```json
{
  "id": "fixture-iron-sword",
  "variant": "melee-weapon",
  "fields": {},
  "tags": [],
  "provenance": {},
  "diagnostics": []
}
```

Slice 4 should add a sibling `presentation` object and bump the item envelope schema version. Presentation is not a canonical field; keeping it separate prevents behavior-rendered UI text from becoming a source table column by accident.

```json
{
  "id": "fixture-iron-sword",
  "variant": "melee-weapon",
  "fields": {},
  "tags": [],
  "presentation": {
    "schemaVersion": 1,
    "renderContext": "item-presentation-v1",
    "displayName": "Iron Sword",
    "displayNameSourceMethod": "GetFullItemName()",
    "itemType": "One-handed weapon",
    "itemTypeSourceMethod": "GetTooltipItemType()",
    "descriptionSource": "A simple iron blade.",
    "effectsSource": "",
    "statRows": [
      {
        "id": "damage",
        "label": "Damage",
        "value": 7.5,
        "valueText": "7.5",
        "suffix": null,
        "size": "large",
        "indent": 0,
        "comparison": null,
        "source": "MeleeItem.GetItemStatInfos()"
      }
    ],
    "requirements": [],
    "durability": {
      "kind": "max-durability",
      "max": 100,
      "source": "meleeDurabilityMax"
    },
    "stateFacts": [
      {
        "kind": "canonical-state",
        "label": "Canonical compendium state",
        "description": "Base item, no player or inventory context."
      }
    ],
    "omissions": [
      {
        "code": "equippedComparisonOmitted",
        "severity": "diagnostic",
        "message": "Equipped comparison requires player inventory state."
      }
    ]
  },
  "provenance": {},
  "diagnostics": []
}
```

The mod may produce presentation strings by calling safe behavior methods when those methods do not require player/inventory state. When a game method would require unsafe global state or UI singletons, the adapter must either use audited data-equivalent logic with a source note or emit an omission diagnostic. It must not instantiate UI panels or trigger hover side effects.

Presentation extraction stays explicit, per item layer. Reflection may be used for known type checks, but not for raw object serialization.

## Item presentation read model

The pipeline writes a public read model separate from the existing field-list model:

```sql
CREATE TABLE item_presentation_rows (
  item_id                     TEXT PRIMARY KEY,
  render_context              TEXT NOT NULL,
  display_name                TEXT NOT NULL,
  display_name_source_method  TEXT NOT NULL,
  item_type                   TEXT,
  item_type_source_method     TEXT,
  description_source          TEXT NOT NULL,
  description_rich_text_json  TEXT NOT NULL,
  effects_source              TEXT NOT NULL,
  effects_rich_text_json      TEXT NOT NULL,
  stat_rows_json              TEXT NOT NULL,
  requirements_json           TEXT NOT NULL,
  durability_json             TEXT,
  state_facts_json            TEXT NOT NULL,
  omissions_json              TEXT NOT NULL,
  value                       INTEGER,
  weight                      REAL,
  display_icon_hash           TEXT,
  display_icon_color          TEXT,
  diagnostics_json            TEXT NOT NULL
);
```

The item detail route loader consumes `item_presentation_rows` directly for pages and tooltips. Slice 4 is a clean cutover: remove `item_detail_rows.fields_json`, its item-detail accessors, and tests if no non-item public route still consumes them. If a temporary inspection surface is genuinely needed while implementing, name it as a private `_debug_*` view or artifact diagnostic, not as a public site read model or route fallback.

Promotion rule: if a JSON field becomes queried, sorted, filtered, or reused by multiple components, promote it to a relational read-model table in the same slice that creates the pressure. Initial `stat_rows_json`, `requirements_json`, and `state_facts_json` are acceptable because they are rendered as ordered blocks rather than queried globally.

`display_name_source_method` and `item_type_source_method` record the method or derivation used, such as `GetFullItemName()`, `GetTooltipItemType()`, or a named audited adapter fallback. The site normally renders the computed values, but the source-method fields are part of the public contract so drift diagnostics and future audits can explain where visible labels came from.

## Rich text contract

The pipeline translates every retained source string into `rich_text_v1` before SQLite emission. The site never parses raw TMP strings for item presentation.

```ts
type RichTextV1 = {
  schemaVersion: 1;
  sourceHash: string;
  nodes: RichTextNode[];
  diagnostics: RichTextDiagnostic[];
};

type RichTextNode =
  | { type: "text"; text: string }
  | { type: "lineBreak" }
  | { type: "strong"; children: RichTextNode[] }
  | { type: "emphasis"; children: RichTextNode[] }
  | { type: "strike"; children: RichTextNode[] }
  | { type: "color"; token: string | null; color: string | null; children: RichTextNode[] }
  | { type: "sprite"; token: string; label: string | null }
  | { type: "entityLink"; targetType: string; targetId: string; label: string }
  | { type: "termLink"; termId: string; label: string }
  | {
      type: "reference";
      targetType: "status-effect" | "spell" | "enchantment";
      targetId: string | null;
      label: string;
    }
  | { type: "diagnostic"; code: string; text: string };
```

Supported input subset for Slice 4:

- plain text;
- newlines and simple paragraph boundaries;
- `<b>`, `<i>`, `<s>` if encountered;
- `<color=...>` only when the color is a validated hex value or maps to an allowed design token;
- game tooltip codes from `ArdenfallMasterData.tooltipCodes` and `tooltipColors` when exported;
- TMP sprite tokens as typed placeholders;
- term links in the `<link="tooltip_...">label</link>` shape;
- unknown tags as escaped text plus diagnostics.

Rejected behavior:

- no raw `{@html}` in the item presentation path;
- no sanitized HTML strings as the durable contract;
- no browser-side parser for raw game markup;
- no silent tag stripping.

## Relationship graph contract

Slice 4 introduces cross-entity linking as generated data. All item links, backlinks, related cards, and future local graph panels consume the same graph.

Core tables:

```sql
CREATE TABLE entity_nodes (
  entity_type     TEXT NOT NULL,
  entity_id       TEXT NOT NULL,
  label           TEXT NOT NULL,
  route_path      TEXT,
  canonical_slug  TEXT,
  is_public       INTEGER NOT NULL,
  PRIMARY KEY (entity_type, entity_id)
);

CREATE TABLE entity_aliases (
  alias_key       TEXT PRIMARY KEY,
  alias_label     TEXT NOT NULL,
  target_type     TEXT NOT NULL,
  target_id       TEXT NOT NULL,
  source          TEXT NOT NULL,
  FOREIGN KEY (target_type, target_id) REFERENCES entity_nodes(entity_type, entity_id)
);

CREATE TABLE entity_redirects (
  from_path       TEXT PRIMARY KEY,
  target_type     TEXT NOT NULL,
  target_id       TEXT NOT NULL,
  reason          TEXT NOT NULL,
  FOREIGN KEY (target_type, target_id) REFERENCES entity_nodes(entity_type, entity_id)
);

CREATE TABLE entity_disambiguations (
  term_key        TEXT PRIMARY KEY,
  label           TEXT NOT NULL,
  options_json    TEXT NOT NULL
);

CREATE TABLE entity_edges (
  edge_id         TEXT PRIMARY KEY,
  source_type     TEXT NOT NULL,
  source_id       TEXT NOT NULL,
  target_type     TEXT NOT NULL,
  target_id       TEXT NOT NULL,
  predicate       TEXT NOT NULL,
  label           TEXT NOT NULL,
  weight          REAL NOT NULL DEFAULT 1,
  evidence_json   TEXT NOT NULL,
  anchor          TEXT,
  FOREIGN KEY (source_type, source_id) REFERENCES entity_nodes(entity_type, entity_id),
  FOREIGN KEY (target_type, target_id) REFERENCES entity_nodes(entity_type, entity_id)
);
```

Initial predicate vocabulary:

```text
variant_of
requires_stat
applies_status
casts_spell
has_enchantment
crafted_from
crafts_into
ingredient_for
sold_by
drops_from
found_in
unlocks_recipe
references_term
```

Rules:

- Edges point to canonical IDs, never display names.
- Every edge carries evidence: snapshot field, source method, pipeline derivation, or curated fixture reason.
- Unknown or future-entity targets become diagnostics unless the target is represented by an inert placeholder node with `is_public = 0`.
- Non-public placeholder nodes may support diagnostics and future re-resolution, but item pages must not render them as normal links. They render as inert text with a diagnostic affordance or are omitted from public relationship sections until the target entity becomes public.
- Aliases resolve directly to one canonical node or to a disambiguation record; duplicate aliases fail or warn according to severity policy.
- Redirects are one-step only. Broken and double redirects are audit failures.
- Section anchors are generated from stable section IDs, not display headings.

Relationship sections on item pages are generated from `entity_edges` and a controlled section map, not hand-authored route markup. First public sections render only when they contain public targets or approved glossary terms:

- `Used by` for public recipes, equipment, ammunition, and future quests;
- `Applies` for public status-effect targets or inert status-effect placeholders with diagnostics;
- `Casts` for public spell targets or inert spell placeholders with diagnostics;
- `Requires` for stats/skills and glossary-backed requirement terms;
- `Related mechanics` for glossary terms;
- `Sources` only when public source entities land.

## Item state UX

Default pages and tooltips render the canonical base item:

- no player;
- no inventory;
- no equipped comparison;
- no merchant/training/repair state;
- no learned-recipe state;
- no current durability;
- no stolen/owned instance state.

Static state facts are page content:

- requirements;
- max durability and durability mechanics applicability;
- possible effects/enchantments/spells/statuses;
- recipe target/ingredients when data is present;
- roll ranges or variant facts when stable;
- local/base stat rows.

Explicit variants are allowed only for stable identities or stable states: separate item IDs, charged/depleted forms, quality/tier forms, crafted/dropped forms, drink/throw potion forms, or behavior that cannot be represented by one field change.

Bounded selectors can follow after the data model proves them: variant, charge count, quality/tier, roll range, or comparison target. A full build calculator remains out of scope.

## Item overview filtering and sorting

`/items` remains prerendered static HTML with a useful full-table fallback. Slice 4 may opt the route into CSR only for the documented purpose of progressive-enhanced URL-state filtering/sorting.

Rules:

- Curated crawlable pages are generated only for durable canonical axes such as item variant/category or major mechanic groups.
- Long-tail filters, search text, and sort order live in URL search params and filter the already-loaded read-model rows in the browser.
- Query-param combinations are excluded from sitemap/crawl paths.
- Empty facet combinations do not get generated pages.
- The no-JS fallback is the unfiltered prerendered item table plus links to curated static category pages.
- Pagefind/FTS5 remains deferred until cross-entity full-text search is a goal.

Canonical URL-state rules:

- Supported query keys are declared by the read model metadata, not by component-local string constants.
- Default values are omitted from the URL.
- Multi-value filters are sorted by their stable value keys before serialization.
- Unknown keys and invalid values are ignored for filtering and dropped on the next client-side canonicalization pass.
- The canonical order is filter keys alphabetically, then `sort`, then `direction`; this avoids multiple URLs for the same table state.
- Filter state never changes the canonical page URL advertised in `<link rel="canonical">`; crawlers see the static `/items` or curated category route.

The filter read model should start with fields already emitted for item overview and presentation: variant, item type/category, value, weight, requirement presence, effect/reference presence, and maybe durability applicability. Do not parse rich-text prose for filters.

## Frontend UI architecture

Slice 4 establishes import layers:

```text
site/src/app.css                         # token contract
site/src/lib/components/ui/              # owned shadcn-svelte/Bits primitives
site/src/lib/components/layout/          # page/section/chrome layout
site/src/lib/components/content/         # RichText and generic content renderers
site/src/lib/components/items/           # item-domain presentation components
site/src/lib/components/relationships/   # graph/related entity components
site/src/routes/items/                   # route assembly only
```

Route files should assemble resolved data and components. They should not encode repeated item header/stat/effect/link markup inline.

Initial shared components:

- `ItemIcon`
- `ItemHeader`
- `ItemStatRow`
- `ItemStatBlock`
- `ItemRequirementList`
- `ItemEffectList`
- `ItemStateFacts`
- `ItemPresentationPanel`
- `ItemTooltipCard`
- `RichText`
- `EntityLink`
- `RelationshipSection`
- `RelatedEntityCard`
- `ItemOverviewFilters`

Tooltip behavior should be static-first. Item links can render tooltip card markup server-side and expose it on hover/focus using CSS. CSR-enhanced Bits UI tooltip/popover behavior may be added later where route-level CSR already exists, but static pages must not require hydration just to expose item facts.

## Tokens and styling

`site/src/app.css` remains the token source. Slice 4 should add semantic tokens before adding one-off component styles.

Candidate semantic tokens:

```css
--surface-panel
--surface-panel-muted
--text-link
--text-link-hover
--text-stat-positive
--text-stat-negative
--text-requirement
--text-diagnostic
--border-panel
--border-tooltip
--color-item-common
--color-item-magic
--color-item-rare
--color-status-positive
--color-status-negative
```

Components use token-backed Tailwind utilities or CSS variables. They must not hardcode hex/RGB colors, arbitrary shadows, or route-local spacing systems. Game-exported colors are normalized through translator/read-model policy before reaching components.

## Component catalog and intake gate

Before route implementation starts, create a deterministic component catalog. The durable output can be `site/src/lib/components/COMPONENTS.json`, generated or validated from colocated metadata.

Each catalog entry contains:

```json
{
  "name": "ItemStatBlock",
  "importPath": "$lib/components/items/ItemStatBlock.svelte",
  "purpose": "Render ordered item stat rows from item_presentation_rows.stat_rows_json.",
  "props": ["rows", "density"],
  "aliases": ["stats", "attributes", "damage rows", "tooltip stats"],
  "useWhen": ["Rendering base/local item stats"],
  "doNotUseWhen": ["Rendering arbitrary key/value metadata"],
  "related": ["ItemStatRow", "ItemPresentationPanel"],
  "tokens": ["--text-stat-positive", "--text-stat-negative"],
  "examples": ["/dev/components/items#item-stat-block"],
  "accessibility": "Rows are semantic list items with visible labels and values."
}
```

Intake gate for a shared component:

1. Check the catalog for existing aliases/related components.
2. Add or update metadata before route adoption.
3. Use typed props only.
4. Use token-backed styling only.
5. Include accessibility notes.
6. Provide a canonical example in the component gallery or an existing prerendered page.
7. Add tests or smoke coverage for interactive behavior.

This is intentionally smaller than Storybook. Storybook can be added when component count, visual review, or visual regression makes it cheaper than the catalog plus gallery.

## Site loader contract

`site/src/lib/server/read-models.ts` gains typed accessors for:

- `getItemPresentation(itemId)`;
- `getItemTooltip(itemId)` if tooltip payload needs a smaller projection;
- `listItemOverviewFilters()`;
- `listEntityRelationshipSections(entityType, entityId)`;
- `getEntityLinkTarget(entityType, entityId)`;
- alias/redirect/disambiguation lookup helpers if route generation consumes them.

Page loaders parse JSON once and return typed props. Svelte components receive already-parsed arrays/objects.

## Diagnostics and artifact reporting

Slice 4 correctness includes diagnostics. The pipeline should count and expose at least:

- unknown rich-text tags;
- malformed TMP tags;
- rejected color values;
- unresolved sprite tokens;
- unresolved tooltip code/color keys;
- unresolved status/spell/enchantment references;
- player-state branch omissions;
- relationship edges with missing targets;
- duplicate aliases;
- broken or double redirects;
- ambiguous untyped references;
- unstable generated anchors;
- item presentation rows missing for public items.

Fatal vs diagnostic policy:

- fatal: unsafe markup would render raw, public item lacks a presentation row, canonical node/edge integrity breaks, or route generation would point to a missing public item;
- diagnostic: optional effect/support target missing, player-state branch omitted by design, unknown tag preserved as escaped diagnostic node;
- optional-empty: truly empty description/effects/state sections.

Artifact manifests should include Slice 4 counts so production smoke can compare the deployed artifact to the intended release.

## Fixture strategy

Synthetic fixtures must grow enough to prove the contracts without checking in bulk game data:

- item with plain description;
- item with `<b>` and `<color>` rich text;
- item with unknown tag diagnostic;
- melee weapon stat rows;
- armor stat rows;
- consumable/status-effect reference, unresolved if support table is absent;
- slate spell reference, unresolved if support table is absent;
- throwing potion drink/throw state fact;
- requirement fact;
- relationship edge to another item or glossary term;
- alias collision/disambiguation case in a pipeline unit test.

Curated real-derived capsules remain optional for implementation planning, but local live validation after implementation should inspect the real `0.0.10.91` snapshot for diagnostic volume and unexpected rich-text tags before release.

## Testing strategy

Mod tests:

- presentation DTO serializes with `renderContext = item-presentation-v1`;
- stat row helpers emit base values with `comparison = null`;
- player-state-only branches produce omissions, not fake values;
- item presentation extraction does not instantiate UI panels or trigger hover side effects.

Pipeline tests:

- snapshot schema accepts item rows with `presentation` and rejects malformed presentation payloads;
- `rich_text_v1` translates supported TMP and escapes/diagnoses unknown tags;
- item presentation read model has one row per public item;
- graph tables reject broken targets, duplicate aliases, and double redirects;
- relationship section read model orders and labels edges deterministically;
- artifact manifest counts include presentation/link diagnostics.

Site tests/smokes:

- `svelte-check` passes with typed component props;
- prerendered item detail HTML contains item header, icon, rich description, stat block, and relationship section markup;
- no item presentation component uses raw `{@html}`;
- item tooltip card content is visible in static HTML and reachable by focus/hover semantics;
- `/items` preserves a useful no-JS table and CSR filter state reads/writes URL search params when enabled;
- component catalog contains every shared Slice 4 component and rejects missing required metadata.

Release smoke after implementation should compare the intended artifact manifest against deployed `/_release.json`, then inspect `/items` and a representative `/items/[id]` for presentation HTML, not just status codes.

## Acceptance criteria

Implementation is complete when:

1. every public item has an `item_presentation_rows` record under `item-presentation-v1`;
2. visible display names and item types retain source/provenance fields in the presentation read model;
3. item pages render from presentation read models, and obsolete `item_detail_rows.fields_json` public site plumbing is removed rather than kept as a fallback;
4. raw game/TMP markup is retained only as source/debug text and never rendered as HTML;
5. `rich_text_v1` renders through typed Svelte components with escaped text bindings;
6. stat rows, requirements, state facts, and durability facts render as structured content;
7. relationship graph tables exist and item pages consume generated relationship sections;
8. public relationship sections never render deferred/non-public placeholder targets as normal links;
9. link audit covers broken targets, duplicate aliases, stale/double redirects, ambiguous terms, and unstable anchors;
10. `/items` has static fallback plus bounded canonical URL-state filtering/sorting if CSR is enabled for that route;
11. shared UI lives in catalogued components under the agreed layers;
12. route files no longer duplicate item header/icon/stat/effect/link markup;
13. diagnostics appear in pipeline output/artifact metadata with fatal/diagnostic/optional-empty policy;
14. local verification covers mod, pipeline, site, formatting/linting, prerender smoke, and specific Slice 4 behavior.

## Roadmap impact

Slice 4 becomes the design-system seed for later presentation-depth slices, but only at the scale proven by item pages. Later slices should reuse `RichText`, `EntityLink`, relationship sections, component catalog metadata, and token conventions. They should not reopen raw HTML rendering, route-local component duplication, or ad hoc cross-linking.

Slice 10 can still own cross-entity full-text search, Pagefind/FTS5, broader faceting, and visual regression/Storybook if accumulated component count warrants it. Slice 4 only creates the contracts that prevent those later investments from requiring a migration of shipped item pages.
