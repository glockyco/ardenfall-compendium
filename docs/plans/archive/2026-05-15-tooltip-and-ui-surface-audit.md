---
title: "Tooltip and UI Surface Decompiled Audit"
type: audit
status: implemented
created: 2026-05-15
parent:
superseded_by:
archived: 2026-06-25
---

# Tooltip and UI Surface Decompiled Audit

**Date:** 2026-05-15  
**Game version:** Ardenfall Demo `0.0.10.91`  
**Decompiled source cache:** `.decompiled/0.0.10.91-63c576261184/`  
**Purpose:** Ground Slice 4 item presentation depth by tracing Ardenfall's tooltip generation, rich-text/link systems, and adjacent UI surfaces worth adapting into the compendium.

## Executive summary

Ardenfall item presentation is not a single field. The visible item panel is assembled by `UI/ItemInfoListUI.cs` from behavior methods on live item instances: `GetFullItemName()`, `GetTooltipDescription()`, `GetEffectsTooltip()`, `GetTooltipItemType()`, `GetItemStatInfos()`, durability interfaces, item value calculations, minimum skill checks, stolen state, and current-equipped comparisons. Those behavior methods then fan out into item tags, enchantments, status effects, spells, potion recipes, durability, character stats, inventory state, and global master-data color/code tables.

Slice 4 should therefore treat game tooltip strings as a behavior-derived presentation source, not as safe final HTML. The compendium needs a dedicated presentation read model plus a conservative Unity/TMP-rich-text translator. Exporting raw strings alone would preserve game wording but would still be unsafe and underspecified; reconstructing everything from existing structured fields would miss runtime behavior. The recommended direction is hybrid: export deterministic, no-player-context presentation fragments and structured stat/link metadata from the mod/pipeline, then sanitize/translate them into static site render models.

The most valuable UI surfaces to adopt first are the item info panel, inventory category/column model, term-link tooltip behavior, status-effect badge/tooltip presentation, and potion recipe ingredient presentation. Cross-linking must be a first-class generated data contract, not page-local markup, because retrofitting typed relationships after pages ship would force every entity page to be reinterpreted. The frontend implementation should also become a small, governed design system rather than a set of route-local Svelte fragments. Quest journal, book/note reading, map/location discovery, character stat sheets, trade breakdowns, and training/repair constraint messages are useful later, but should not expand Slice 4 unless directly needed by item pages.

## Primary item tooltip surface

`UI/ItemInfoListUI.cs` is the canonical item presentation panel. `ApplyItemInternal()` sets the active item and calls `SetBasicStuff()` plus `UpdateStatValues()`.

`SetBasicStuff()` renders:

- title from `item.GetFullItemName()`;
- description from `item.GetTooltipDescription()`;
- effects from `item.GetEffectsTooltip()`;
- type from `item.GetTooltipItemType()`;
- minimum skill requirement for `EquipItem.GetMinimumStat()`, including player stat comparison and an unmet-skill message;
- weight from `item.GetFullItemWeight()`;
- durability for `IItemDurability`, including percent badge, color state, and broken/ruined messages;
- value from `item.GetFullItemMoneyValue()` or trade-specific `InventoryUI.CalculateItemValue()`;
- debug enchantment text;
- stolen indicator.

`UpdateStatValues()` renders each `ItemStatInfo` from `item.GetItemStatInfos()`. If the item is an `EquipItem`, it may show a "Comparing Equipped {0}" label by calling `ItemStatInfo.GetComparingItem()`. This makes comparison output explicitly player/inventory-state dependent and unsuitable for a static compendium unless we define a separate comparison contract.

### Compendium implication

The Slice 4 item detail and hover tooltip should be modeled as an item info panel, not as a generic field list. The public read model should have explicit presentation fields: title/name, item type, rich description, rich effects, stat rows, value, weight, durability metadata if applicable, tag/effect groups, icon/color, and diagnostics. Player-state-only fields should be omitted or marked unavailable rather than faked.

## Item behavior methods that feed the panel

### Base item behavior

`Item/BaseItem.cs` provides the default behavior:

- `GetFullItemName()` returns `itemData.itemName.Get() ?? ""`.
- `GetTooltipDescription()` returns `itemData.description.Get()`.
- `GetTooltipItemType()` returns `null`.
- `GetItemStatInfos()` returns an empty list.
- `GetIcon()` prefers `itemData.icon.Get()` and falls back to `itemData.category.Get()?.defaultItemIcon`.
- `GetIconColor()` falls back to `itemData.category.Get()?.categoryColor ?? Color.white`.
- `GetEffectsTooltip()` walks `itemData.tags.Get()` and, for tags with name and description, appends `StatusEffectUtil.CombineMainAndSubTooltips(item.tagName + ":", item.description)`.

### Equipment and enchantments

`Item/EquipItem.cs` adds enchantment effects to `GetEffectsTooltip()`. Each visible enchantment appends `enchantmentState.data.GetTooltip(enchantmentState.baseLevel, itemData)` unless hidden. `EquipItem.GetMinimumStat()` and `PassesMinimumStat()` drive the item panel's requirement message and reduced-effectiveness states. Equipment naming generally stays the item name, but durability-aware subclasses modify names.

`EnchantmentTooltip.cs` evaluates tooltip variables against `EnchantmentEffect` components via `StringTooltip.GetValueFromField()`. It also supports target-specific text when an enchantment has `TooltipItemTargetEnchVar` entries for particular `ItemData` assets. Slice 4 must not assume an enchantment tooltip is only a static string.

### Weapon, armor, and projectile stat rows

The game uses `ItemStatInfo` rows for compact stat display:

- `ArmorItem.GetItemStatInfos()` adds large `Damage Threshold` from base armor rating.
- `MeleeItem.GetItemStatInfos()` adds large `Damage` and `Heavy Attack Damage`.
- `BowItem.GetItemStatInfos()` adds large `Damage`.
- `ArrowItem.GetItemStatInfos()` adds large `Damage`.
- `ThrowingItem.GetItemStatInfos()` adds large `Damage`.
- `SlateSpellItem.GetItemStatInfos()` adds large `Mana Usage`.

`UI/ItemInfoStatUI.cs` renders numeric value, relative comparison value, optional original struck-through value, suffix, indentation, and large-text styling. Relative values come from `ItemStatInfo.GetComparisonTooltip()` and require the currently equipped item. Static compendium rows should export/display base values and suppress comparison deltas unless a later feature chooses an explicit comparison baseline.

### Consumables and status-effect-driven effects

`ConsumableItem.GetEffectsTooltip()` builds an `<b>On Consume:</b>` section from `itemData.statusEffects.Get()`. Each effect calls `StatusEffectData.GetTooltip(level, lifetime, targetSelf: true)`, non-empty tooltips are combined by `StatusEffectUtil.CombineEffectTooltips()`, then nested under the section heading via `CombineMainAndSubTooltips()`.

`ThrowingPotion.GetEffectsTooltip()` is similar but selects the heading based on `isDrinkingPotion`: `<b>On Drink:</b>` for self-targeted drink potions or `<b>On Hit:</b>` for thrown potions. It uses `areaOfEffect.Get()` status effects and passes `targetSelf` equal to the drink/throw mode. `ThrowingPotion.GetFullItemName()` replaces `{lvl}` with an `ItemLevelNames` label and `{name}` with the first status effect name.

These classes also implement `IHoverItem.OnHoverStateChange()` and call effect hover hooks, which can alter HUD/player state. The compendium should ignore hover side effects and only capture displayable tooltip content.

### Slate spells and spell effects

`SlateSpellItem.GetEffectsTooltip()` calls `SpellData.GetTooltip()` for primary and optional secondary spell data, trims newlines, and combines that spell text with base/enchantment effects. `SlateSpellItem.GetTooltipItemType()` renders the spell stat type plus `Scroll`, `Slate`, or `Stave`. `GetFullItemName()` replaces `{lvl}` and `{name}` placeholders and applies durability name modifiers.

`SpellData.GetTooltip()` composes:

1. `spellData.tooltip.GetTooltip(level, secondaryLevel, this)`;
2. per-spell `SpellEffect.GetTooltip(level)` snippets, sentence-normalized;
3. per-spell `SpellEffect.GetSubTooltips(...)`, colored with `ArdenfallMasterData.Instance.spellSubEffectColor`;
4. `ArdenfallMasterData.Instance.primarySpellTooltip` or `.secondarySpellTooltip` prefix.

This means slate spell item presentation cannot be faithfully completed from `ItemData` alone. It needs spell tooltip data, spell effects, and master-data strings/colors.

### Potion recipes

`PotionRecipeItem.GetFullItemName()` appends `(Learned)` when `PotionRecipeManager` says the recipe is unlocked. `GetTooltipDescription()` appends `PotionRecipeManager.potionRecipeDescription` formatted with `itemData.recipe.Get().RecipeName`.

The learned/unlearned suffix is player-state dependent. The static compendium should render the recipe identity and recipe target, not a fake learned state. A future recipe page can show craftability independent of player ownership.

## Item state modeling

The annotation question on item state is architectural, not cosmetic. The game panel mixes stable item facts with current player state:

- stable facts: item identity, item type, base description/effects, base value/weight, max durability, requirement thresholds, recipe identity, status/spell/enchantment definitions;
- mutable item instance state: current durability, generated enchantments, potion level/name substitutions, charges if a future item type has them, stolen state, learned recipe state;
- player/build state: equipped comparison item, current skill values, pass/fail requirement coloring, merchant relationship/barter, affordability, inventory ownership, hover effects that modify HUD bars.

Mature game wikis generally separate canonical item identity from configurable state. Path of Exile distinguishes item-local modifiers from global/conditional player modifiers; local modifiers can change innate item properties, while global/conditional modifiers affect the character or circumstances and should not be folded into base item stats. OSRS-style charged item pages show state variants as explicit tabs/sections with item IDs, uses, prices, and comparisons rather than hiding them in prose. Terraria documents that displayed tooltip values can differ from exact mechanics due to rounding, which is a warning for Ardenfall if behavior-rendered strings and raw exported numbers ever diverge.

Slice 4 should therefore pick a canonical state before implementation:

1. **Canonical page state:** base exported item, no simulated player, no current inventory, no equipped comparison, no merchant/training state. This is the default page and the default hover tooltip.
2. **State facts as page content:** requirements, max durability, possible enchantments/effects, recipe target, status/spell references, and local/base stat rows should be shown as regular item content, not hidden behind alternate tooltips.
3. **Explicit variants only when identity is stable:** separate related records or selector states are appropriate for distinct item IDs, charged/depleted forms, quality/tier forms, crafted vs. dropped forms, potion drink/throw forms, or behavior that cannot be represented by changing one value.
4. **Optional selectors later:** visitor-configurable selectors are valuable only for bounded dimensions such as variant, charge count, quality/tier, roll range, or comparison target. Full build simulation is overkill until stats, slots, modifiers, effects, and conditions have stable entity models.
5. **Diagnostics for omitted state:** player-state-only behavior should produce explicit diagnostics or explanatory UI copy, not silent absence.

The UX priority for players is answering “should I use, keep, craft, buy, or look for this?” quickly. That argues for a single canonical tooltip plus state/condition sections on the page. Multiple alternate hover tooltips would add interaction cost and hide important facts; a configurable tooltip should wait until there is a specific, bounded comparison task.

## Rich text, color, link, and token systems

### `StringTooltip` status/spell/enchantment variables

`StringTooltip.cs` is the central tooltip variable and color helper.

`GetValueFromField()` resolves variables by reflection against a target component. It checks fields, properties, and methods; supports `LeveledInt`, `LeveledFloat`, `int`, `float`, percentage encodings, inversion, one-minus, multipliers, additive offsets, rounding, absolute values, and dynamic variables such as level/lifetime. It also recursively renders nested `LeveledStatusEffect` and `LeveledLeveledStatusEffect` values by calling their status effect tooltip.

`StatusEffectTooltip.cs`, `SpellTooltip.cs`, and `EnchantmentTooltip.cs` all use this mechanism. They are data-driven templates, not plain strings.

### Color and code expansion

`StringTooltip.ApplyColors()` handles tooltip-specific codes:

- `[l ...]`, `[t ...]`, `[n ...]`, `[p ...]` become colored spans using duration, target, negative, and positive colors.
- Every `]` becomes `</color>` after partial-code replacement.
- `ArdenfallMasterData.tooltipColors` maps custom codes to colored labels.
- `ArdenfallMasterData.tooltipCodes` maps arbitrary codes to replacement text.
- Status effects additionally replace `{level}`, `{lifetime}`, `{target}`, and conditionally remove or keep `[lif ...]` spans based on lifetime.

`ArdenfallMasterData.cs` also exposes master icon/message strings such as `unmetSkillIcon`, `brokenDurabilityIcon`, `ruinedDurabilityIcon`, `illegalItemMerchantIcon`, `stolenItemMerchantIcon`, and the corresponding reduced-effectiveness messages. These strings commonly contain TMP sprite tags and formatting placeholders.

### Term links in dialog/journal text

`ArdenfallMasterData.ApplyColorCodes()` is separate from tooltip effect strings. It applies term-set colors and creates TMP links in the form `<link="tooltip_{definition}">...</link>` when a term has a definition and links are not disabled. `UI/TooltipLinkTextUI.cs` detects hovered TMP links whose ID starts with `tooltip_`, extracts the definition, and displays a generic tooltip.

This is important for Slice 4 because item descriptions/effects may not be the only rich-text source. The compendium rich-text translator should be reusable for dialogue, quest journals, books, and term-linked glossary text later.

### Required site translator behavior

The site must treat Unity/TMP markup as untrusted input. The translator should accept a narrow subset and emit a typed render tree or sanitized Svelte components:

- text;
- line breaks;
- bold/italic/strikethrough;
- color spans with validated hex colors or known design tokens;
- sprite tokens as typed icon placeholders, not raw HTML;
- term/tooltip links as structured inline tooltip references;
- page breaks for books/notes later;
- unknown tags as escaped text plus diagnostics.

Direct `{@html}` rendering of game strings is not acceptable.

## Generic tooltip infrastructure in the game

Ardenfall has a small generic tooltip interface:

- `Item/ITooltipOwner.cs` defines `GetTooltipData()` and `GetTooltipName()`.
- `UI/TooltipUI.cs` destroys previous rows, sets optional header text, instantiates one text row per `GetTooltipData()` entry, and can follow the mouse.
- `UI/SimpleHoverTooltip.cs` wraps a single text tooltip.
- `UI/TooltipLinkTextUI.cs` turns TMP link IDs into simple tooltips.
- `UI/StatusEffectIconPrefabUI.cs` implements `ITooltipOwner` for active status effects, including effect name, remaining time, and effect tooltip.
- `UI/StatusEffectTooltipContainerUI.cs` hosts status-effect tooltip display via messages.
- `UI/ItemTooltipInstanceUI.cs` is a singleton tooltip host using `TooltipUI`.

The compendium equivalent should not mirror Unity's singleton/mouse-following mechanics. It should keep the useful contract: a trigger has a title plus one or more rich content blocks, and the same content should be visible via hover and keyboard focus.

## Wiki and knowledge-management lessons for cross-linking

External wiki and knowledge-management systems all point to the same conclusion: links are infrastructure. MediaWiki records internal links in link tables, supports redirects for alternate names, exposes “what links here,” and treats broken/double redirects as maintenance problems. Wikipedia's linking guidance warns against both underlinking and overlinking, recommends linking the most specific appropriate target, and notes that raw section links break when headings move unless stable anchors or redirects exist. Obsidian makes backlinks, aliases, and local graph views core primitives; its global graph is powerful but high-cost, while the local graph is useful because it is scoped to the active note. NN/g's navigation research is also relevant: search alone is not enough because users often do not know the search space, while facets and navigation teach them what dimensions exist.

For Ardenfall, this means Slice 4 should not implement cross-links as ad hoc `<a>` tags inside Svelte components. The pipeline should emit a typed relationship graph that all pages consume:

- stable canonical entity IDs, with slugs and display names treated as mutable labels;
- aliases for alternate names, spellings, punctuation, player terms, and renamed content;
- one-step redirects or generated redirect routes for aliases and old slugs, with broken/double redirect checks;
- disambiguation records when one term maps to multiple entities and no primary target is safe;
- typed edges with `source_type`, `source_id`, `target_type`, `target_id`, `predicate`, `label`, `weight`, `evidence`, and optional stable `anchor`;
- generated inbound and outbound relationship sections such as `Sources`, `Used by`, `Crafts`, `Required by quests`, `Sold by`, `Drops from`, `Found in`, and `Related mechanics`;
- a link audit that fails or warns on broken targets, duplicate aliases, orphan pages, stale redirects, ambiguous untyped references, and unstable section anchors.

The compendium should use links as information scent, not decoration. A related link/card should explain why it exists: entity name, entity type, and the relationship in player terms. Example: `Iron Ore — Item, used by 12 recipes`; `Poison — Status effect, applied by this potion`; `Sunken Crypt — Location, source for this drop`. This is more valuable than a graph visualization by default. A compact local graph may become useful later, but a sitewide force-directed graph is deferred until there is a concrete player workflow it solves.

The same contract should support glossary terms. Glossary entries are appropriate for recurring mechanics that affect decisions: stats, damage types, rarity/quality, requirements, durability, proc/trigger concepts, source/destination labels, faction, drop chance, respawn, and crafting terms. Glossary links should have aliases and backlinks like entity pages. Unlinked mention mining can be an offline QA report, not runtime behavior; deterministic extracted relationships and approved term links are safer than scanning every page at request time.

## UI implementation architecture lessons

The Ancient Kingdoms failure mode was not “missing CSS polish”; it was missing UI governance. Modern design-system practice points to the same conclusion as wiki-linking practice: consistency must be encoded as reusable structure plus process, not recovered by asking each page author to make tasteful choices.

For this repo, the right scale is a small owned component system, not an enterprise design-system program:

1. **Tokens are the first API.** `site/src/app.css` already owns Tailwind/theme variables. Slice 4 should strengthen that into a layered token contract: primitive palette/spacing/type values, semantic tokens such as surface/text/border/link/rarity/status, and only then component-level aliases where a repeated component needs one. Svelte components should reference token-backed Tailwind utilities or CSS variables, not raw hex, RGB, one-off shadows, or inline spacing values. This makes dark mode, rarity colors, item state colors, and future visual refreshes data changes rather than component rewrites.
2. **Use the existing headless primitive stack.** The site already has `bits-ui` and owned shadcn-svelte primitives under `site/src/lib/components/ui/`. That should remain the interaction/accessibility foundation. Do not reimplement dialog, tooltip, tabs, select, popover, menu, or combobox behavior in route files. Edit owned shadcn-svelte wrappers when project styling or API changes are needed; compose them for domain UI. Avoid introducing a second UI framework unless a concrete missing primitive cannot be built on this stack.
3. **Layer components by responsibility.** A maintainable Svelte UI should have clear import directions:
   - tokens in `app.css`;
   - primitive/styled UI wrappers in `src/lib/components/ui/`;
   - layout components in `src/lib/components/layout/` for page chrome, containers, sections, stacks, and headers;
   - domain presentational components in `src/lib/components/items/` and later sibling domains;
   - route pages that assemble domain components and pass fully resolved data.

   Components must not open SQLite, parse descriptors, or fetch generated data. Read models and route loaders shape data; components render typed props. This preserves static prerendering and makes the UI layer testable outside a route.

4. **Make component discovery a build artifact.** A human README helps, but agents need a deterministic index. Slice 4 should introduce a component catalog such as `site/src/lib/components/COMPONENTS.json` generated or validated from colocated component metadata. Each shared component should have a purpose, import path, props summary, aliases/search terms, “use this when,” “do not use this when,” related components, consumed tokens, and canonical examples. The repo’s `AGENTS.md`/site guidance should point agents to that index before they create UI.
5. **Adopt a lightweight component intake gate.** A new shared component should be added only when it is reused, expected to be reused soon, or encodes a hard accessibility/semantic pattern. Before adding it, check the catalog for existing aliases and related components. Before accepting it, require typed props, token-only styling, accessibility notes, at least one canonical example, and tests or page-level coverage for interactive behavior. This is the small-repo equivalent of GOV.UK’s “usable, consistent, versatile” contribution criteria.
6. **Document components with usage guidance, not just API.** Mature design systems document what a component is, when to use it, when not to use it, how it works, code examples, accessibility constraints, known limitations, and research status. That exact structure is useful for LLMs because it prevents visual-name guessing. “ItemStatBlock: use for labeled game stat rows; do not use for arbitrary key/value metadata” is more valuable than “a bordered list.”
7. **Prefer a dev gallery before Storybook.** Storybook is excellent once component count, visual review, or cross-role collaboration justifies it. For Slice 4, a static-first repo can get most of the value from a prerendered dev-only component gallery or canonical example routes plus generated metadata. Add Storybook later if visual regression review or component count makes it the cheaper catalog. Do not make Storybook the source of truth before the component metadata exists.
8. **Test consistency where it breaks.** Automated accessibility and interaction tests should cover the representative page states and interactive primitives. Storybook and Playwright both emphasize that stories/examples can be tests; for this repo, start with component examples plus `svelte-check`, role/keyboard assertions for interactive wrappers, and page-level axe scans for home, item overview, item detail, error route, and any client-enhanced filter UI. Visual regression can wait until visual drift recurs, but the component gallery should be screenshot-ready.

Concrete Slice 4 component candidates:

- `ItemHeader` — icon, name, type, rarity/quality/state badges, compact and full variants;
- `ItemIcon` — generated asset rendering, fallback behavior, color/tint handling;
- `ItemStatRow` and `ItemStatBlock` — base/local stat display without player comparison by default;
- `ItemRequirementList` — skill/stat requirements as static facts;
- `ItemEffectList` — on-use/on-hit/enchantment/status/spell effect groups backed by rich text;
- `RichText` — the only renderer for `rich_text_v1` nodes;
- `RelationshipSection` and `RelatedEntityCard` — generated graph edges with player-readable predicates;
- `ItemSourceList` — drops, vendors, recipes, quests, found-in rows once those edges exist;
- `ItemOverviewFilters` — the bounded client component for URL-state filtering/sorting.

These names should enter the component catalog before route implementation starts. Route-local item markup should be treated as temporary only when it is genuinely single-use; once a pattern appears twice, promote it immediately or the second copy becomes the seed of design drift.

## Other UI surfaces worth adopting

### Adopt in Slice 4

1. **Item info panel layout**  
   The current compendium detail page is a field list. The game panel offers a better hierarchy: icon/name/type, description, effects, requirements, stat rows, value/weight/durability. This should become the Slice 4 item detail and tooltip content model.

2. **Inventory category and column model**  
   `InventoryUI.cs`, `InventorySlotUI.cs`, `ItemCategory.cs`, and `ItemColumnButtonUI.cs` define category tabs, sortable columns, item name/icon columns, value/weight/style columns, skill/durability modifier coloring, stolen/illegal markers, favorite/quickslot markers, and hidden negative-one fields. Slice 4 overview filters/sorts should borrow the model conceptually, but use generated static data and URL state rather than Unity focus/input state.

3. **Term-link tooltips**  
   `ApplyColorCodes()` plus `TooltipLinkTextUI.cs` is directly relevant to glossary-like compendium content. It supports inline colored terms with hover definitions. Slice 4 should design `RichText` so term links are first-class, even if the initial item set only uses a subset.

4. **Status-effect badge and tooltip presentation**  
   `StatusEffectIconPrefabUI.cs` and `StatusEffectTooltipUI.cs` show effect icon, level roman numerals, lifetime, and tooltip text. Consumables, throwing potions, slate spells, enchantments, and later spells/monsters all benefit from this representation. Slice 4 can start by rendering status-effect references in item effects as rich text; badge extraction can follow if status effect assets are available.

5. **Potion recipe ingredient presentation**  
   `PotionCraftLayerUI.cs`, `PotionRecipeSlotUI.cs`, and `PotionRecipeItemSlotUI.cs` expose a strong pattern for recipes: recipe list, drinkable/throwable tabs, crafted result preview via `ItemInfoListUI`, ingredient tag/count rows, craftable/owned counts, and requirement lock tooltips. Slice 4 should at least ensure potion recipe item pages link to recipe target/ingredients if data is available; a full crafting page can be a later item-adjacent slice.

### Track for later slices

1. **Book/note reader**  
   `ReadNoteUILayer.cs`, `NoteStyle.cs`, `BookNoteStyle.cs`, and `PageNoteStyle.cs` handle note prefabs, font assets, `<t>`, `<n>`, `\t`, `\n`, `<page>`, two-page book rendering, page numbers, and full-read events. This is valuable when note/book presentation becomes a focus. It should share the rich-text translator, especially page breaks, but not block Slice 4 unless note items are promoted beyond simple item rows.

2. **Quest journal**  
   `QuestUI.cs`, `SelectedQuestUI.cs`, `QuestPhaseUI.cs`, `QuestObjectiveUI.cs`, and `JournalEntryUI.cs` model quest lists, current/completed tabs, phases, required/optional objectives, failed/succeeded icons, strikethrough completed objectives, and journal entries with quest subnames. This is a later quest slice, but it reinforces that term links and safe rich text should be reusable beyond items.

3. **Map/location discovery surface**  
   `LocationInfoUI.cs`, `MapMarkerInfoUI.cs`, `WorldMapUI.cs`, and `PlayerWorldMapUI.cs` point toward location names, discovery banners, and map marker interactions. These belong to Slice 5/6 rather than Slice 4.

4. **Character/stat sheet and stat tooltips**  
   `CharacterInfoUI.cs`, `ViewStatsListUI.cs`, and `AttributeVisualPrefabUI.cs` render attributes/skills, modified values, icons/colors, long stat descriptions, major-skill markers, and stat modification tooltips. This becomes useful once the compendium has stats, races, classes, or skill requirements. Slice 4 should only borrow the stat-row visual grammar.

5. **Trade, training, repair, and constraint breakdowns**  
   `TradeTooltipUI.cs`, `TradeTooltipItemUI.cs`, `TrainLayerUI.cs`, `TrainItemUI.cs`, and `RepairItemUI.cs` show player-state-heavy calculations: relationship, barter, merchant discounts, training availability/cost, repair amount/cost, and failure tooltips. These are not appropriate as static item facts, but their failure-message style is useful for future guides.

6. **Generic message/toast surface**  
   `GenericInfoUI.cs`, `InventoryChangeInfoUI.cs`, `XPInfoUI.cs`, `SkillCheckInfoUI.cs`, `ReputationInfoUI.cs`, and related queued UIs are mostly runtime feedback. They are not content models for the compendium, but they provide wording examples for consequences and status changes.

## Data and architecture implications for Slice 4

### New or expanded artifact data likely needed

Slice 4 likely needs a generated item presentation read model separate from the current `item_detail_rows.fields_json` field-list model. Candidate fields:

- `item_id`;
- `display_name` from behavior-derived `GetFullItemName()` in a no-player/default state;
- `item_type` from `GetTooltipItemType()`;
- `description_source` and `description_rich_text_json` from `GetTooltipDescription()`;
- `effects_source` and `effects_rich_text_json` from `GetEffectsTooltip()`;
- `stat_rows_json` with label, value, suffix, large/indent flags, and no player comparison delta by default;
- `requirements_json` for minimum skill/stat requirements as facts, not pass/fail player state;
- `durability_json` for max durability and whether durability mechanics apply, not current durability percentage;
- `value`, `weight`, icon hash/color;
- `relationship_edges_json` or normalized `entity_edges` rows for outgoing and incoming links;
- `aliases_json` or normalized alias rows for search, redirects, and disambiguation;
- `presentation_diagnostics_json` for unknown tags, unresolved status/spell/enchantment references, player-state omissions, unsafe markup, unresolved links, duplicate aliases, and stale redirects.

If the mod exports behavior-rendered strings, it should also record the render context version used. The deterministic compendium context should avoid current-player inventory, equipped comparisons, stolen ownership state, current durability, learned recipes, and merchant/training state.

### Rich text should be a pipeline/site contract

The translator can live in the pipeline, site, or both, but the deploy artifact should expose a stable contract. Prefer storing original source plus a typed render tree in SQLite, with generated diagnostics tied to the field that produced them. Do not make the browser parse raw game markup for static pages.

### Cross-linking should be a generated graph contract

A wiki-like compendium needs relationship data before it needs a visual graph. The build pipeline should materialize canonical entity nodes, aliases, redirects, glossary terms, and typed edges into SQLite. Site components should render relationship sections from that graph rather than each entity page hand-authoring links. This keeps backlinks, local related-content panels, search facets, and future graph visualizations consistent.

The graph contract should be strict:

- every edge target resolves to a canonical entity or glossary term;
- every alias resolves directly to one canonical target or a disambiguation record;
- redirects are one-step only;
- generated section anchors are stable and audited;
- unknown extracted references become diagnostics, not silent plain text;
- relationship predicates are controlled vocabulary, not arbitrary prose.

This is the main long-term-maintenance lesson from wiki software: link tables, redirects, aliases, categories/facets, and infobox/template data must be data structures, not incidental markup.

### Diagnostics are part of correctness

Unknown TMP tags, unresolved sprite tokens, missing tooltip codes, null status/spell references, and player-state-only branches should be counted and surfaced in the artifact manifest or pipeline diagnostics. Slice 4 should not silently drop tooltip segments.

## Recommended Slice 4 scope

### Include

- item presentation read model for details and hover/focus tooltips;
- safe rich-text translator that emits a versioned JSON render tree plus retained source strings and diagnostics for the markup subset encountered in item descriptions/effects/tooltips;
- stat-row rendering from `ItemStatInfo` without equipped-item comparison deltas;
- item type, effects, description, requirements-as-facts, value, weight, icon/color;
- narrow status/spell/enchantment/master-data support exports required to resolve item effect references safely;
- relationship graph foundation: canonical IDs, aliases, redirects/disambiguation, typed entity edges, inbound/outbound related sections, and link diagnostics;
- UI implementation architecture foundation: token contract, layout/domain component layers, component catalog, component intake gate, and initial item presentation components;
- item overview filtering/sorting by generated item facts with a progressive-enhanced URL-state client component and only curated crawlable static category pages;
- diagnostics for unsupported tooltip and link features.

### Defer

- player-equipped comparison deltas as default tooltip behavior;
- user-configurable build simulation;
- current durability percentages and broken/ruined state unless represented as static mechanics facts;
- learned/unlearned recipe state;
- merchant buy/sell price breakdowns;
- training/repair/player affordability states;
- sitewide graph visualization;
- full Storybook or visual-regression service unless component count, visual review, or recurring drift makes it cheaper than a dev gallery plus metadata;
- full note/book reader;
- full quest journal;
- map/location UI;
- full status-effect/spell entity pages beyond the narrow tables needed to resolve item effects safely.

## Recommended Slice 4 design answers

The annotated open questions now have enough external precedent to become design defaults. Slice 4 should still validate the exact schema against the current snapshot, but the implementation plan should start from these answers rather than reopening the choices:

1. **Tooltip export cut:** use a hybrid, with structured data as the canonical contract. The mod should export deterministic behavior-rendered TMP source strings for name/description/effects under the compendium render context, but it must also export typed stat rows, requirement records, status/spell/enchantment references, item-state facts, and relationship evidence. Rendered strings preserve in-game wording and detect translator drift; structured facts drive sorting, filtering, graph edges, and cross-links. No gameplay fact should exist only inside prose.
2. **Deterministic render context:** define and version a compendium render context: no current player, no inventory, no equipped comparison item, no stolen ownership state, no current durability, no merchant/training/repair UI, no learned-recipe manager, no affordability, and no hover side effects. Player-state branches become explicit omission diagnostics counted in the artifact manifest. Do not synthesize a fake player to make game methods return convenient text.
3. **Item state UX:** ship one canonical base page and hover tooltip by default. Represent static state facts on the page: requirements, max durability, possible enchantments/effects, recipe targets, charge or use mechanics, local/base stats, and min/max roll ranges. Create explicit variants only when the game exposes stable identities or stable states such as separate item IDs, charged/depleted forms, quality/tier forms, crafted/dropped forms, drink/throw potion forms, or behavior that cannot be represented by one field change. Bounded selectors may follow for precomputed axes such as variant, charge count, quality/tier, roll range, or comparison target. Player/build calculators remain deferred.
4. **Rich-text storage:** store original TMP source for audit/debugging and a `rich_text_v1` JSON render tree for rendering. Translate source to typed nodes in the pipeline, not in the browser: text, line break, emphasis, validated color token, sprite/icon token, entity link, glossary/term link, status/spell/enchantment reference, and diagnostic placeholder. Svelte should render the tree through components and normal escaped text bindings; raw `{@html}` and sanitized HTML strings should not be part of the item presentation path.
5. **Required supporting assets:** item effect rendering needs at least the status-effect, spell, enchantment, master tooltip-code/color, and sprite/icon records referenced by current item behavior. Slice 4 should either include narrow exporters/read models for those records or fail/warn with unresolved-reference diagnostics. It should not silently drop effect text, strip links, or pretend opaque strings are complete structured presentation.
6. **Initial relationship vocabulary:** keep predicates small and controlled. A practical first set is `variant_of`, `requires_stat`, `applies_status`, `casts_spell`, `has_enchantment`, `crafted_from`, `crafts_into`, `ingredient_for`, `sold_by`, `drops_from`, `found_in`, `unlocks_recipe`, and `references_term`. Aliases, redirects, and disambiguation should be separate node/lookup tables, not freeform edge labels. Adding predicates later is cheap only if every edge already has evidence and every page consumes generated relationship sections.
7. **`/items` filtering/sorting:** keep the static architecture. Generate crawlable static listing pages only for curated canonical axes with durable value, such as item type/category and possibly major source/mechanic groupings. Put long-tail filters, search text, and sort order in a small progressive-enhanced client component whose source of truth is URL search params. Exclude query-param facet combinations from sitemap/crawl paths, do not generate crawlable pages for empty facet combinations, and keep a no-JS default table/form fallback. Pagefind-style filters are useful when cross-entity full-text search becomes a goal; for Slice 4 structured item filters over generated rows are simpler.
8. **UI implementation architecture:** build a small design-system layer before item pages grow. Keep shadcn-svelte/Bits UI as the owned primitive stack, add layout and item-domain component layers, make `app.css` tokens the styling API, and require a component catalog before creating route-local UI patterns. The first implementation plan should include `RichText`, item header/icon/stat/effect/requirement/source/relationship components, and a discoverability process for humans and agents. Defer Storybook until it solves a concrete catalog/review/testing problem that metadata plus a dev gallery cannot solve.

## Bottom line

Slice 4 should not be framed as "add tooltip CSS." It is a presentation-contract, linking-contract, and UI-architecture slice. The game assembles item presentation from behavior, rich-text templates, master-data code tables, status/spell/enchantment systems, and player-state-aware UI. Wiki and knowledge-management systems show that robust cross-linking must also be designed as generated data from the beginning. Design-system research shows that visual consistency must be encoded as tokens, owned components, documentation, examples, and tests from the beginning. The compendium should adopt the shape and semantics that are stable content facts, translate rich text safely, materialize typed relationships, route all recurring UI through a discoverable component layer, and explicitly omit or diagnose player-state-only behavior.

## External sources consulted

- MediaWiki Help:Links — internal links are tracked in `pagelinks`, and title matching/case behavior makes mutable title-based identity risky: <https://www.mediawiki.org/wiki/Help:Links>.
- MediaWiki Help:Redirects — redirects support alternate names, punctuation, capitalization, and spellings; double and broken redirects are explicit maintenance problems: <https://www.mediawiki.org/wiki/Help:Redirects>.
- Wikipedia Manual of Style/Linking — link the most specific appropriate topic, avoid underlinking/overlinking, avoid surprising piped links, and protect section links with stable anchors/redirects: <https://en.wikipedia.org/wiki/Wikipedia:Manual_of_Style/Linking>.
- Wikipedia Red link and Disambiguation guidance — missing links can be useful but ambiguous targets are dangerous; ambiguous terms need disambiguation or hatnotes: <https://en.wikipedia.org/wiki/Wikipedia:Red_link> and <https://en.wikipedia.org/wiki/Wikipedia:Disambiguation>.
- Wikipedia/MediaWiki What links here — backlinks are built from link/redirect/transclusion tables, not text search, and section backlinks have limitations: <https://en.wikipedia.org/wiki/Help:What_links_here>.
- MediaWiki Help:Categories and Semantic MediaWiki semantic templates — categories/facets and infobox/templates are structured data contracts, not just visual markup: <https://www.mediawiki.org/wiki/Help:Categories> and <https://www.semantic-mediawiki.org/wiki/Help:Semantic_templates>.
- Obsidian Backlinks, Aliases, and Graph view — backlinks distinguish linked/unlinked mentions, aliases are alternate names, and local graphs are scoped relationship views: <https://help.obsidian.md/backlinks>, <https://help.obsidian.md/aliases>, and <https://help.obsidian.md/plugins/graph>.
- NN/g Search Is Not Enough and information-scent research — navigation/facets teach the search space and link labels/context must communicate why a link is relevant: <https://www.nngroup.com/articles/search-not-enough/> and <https://www.nngroup.com/articles/information-scent/>.
- Pagefind filtering docs — static sites can expose generated metadata/facets with `data-pagefind-filter`, which fits the generated compendium architecture: <https://pagefind.app/docs/filtering/>.
- Google crawling guidance for faceted navigation — URL-param facets can create effectively infinite crawl spaces; disallow or tightly curate non-canonical filter URLs and return 404 for empty combinations: <https://developers.google.com/crawling/docs/faceted-navigation>.
- SvelteKit adapter-static docs — static deployment prerenders the site as files; per-request filtered pages require another adapter, so long-tail filters must be generated ahead of time or run client-side: <https://svelte.dev/docs/kit/adapter-static>.
- Svelte `{@html}` docs and OWASP XSS guidance — raw HTML injection is an explicit escape hatch, sanitization must be context-aware, and mutating sanitized HTML voids guarantees; item rich text should render from typed nodes instead: <https://svelte.dev/docs/svelte/@html> and <https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html>.
- Portable Text structured-content model — typed JSON blocks/annotations keep links queryable and renderable across targets without regexing HTML strings, which matches the compendium's rich-text and cross-linking needs: <https://www.portabletext.org/introduction/>.
- MediaWiki Cargo and multiple-instance templates — mature wikis store infobox/template facts in queryable tables and model repeated structures such as recipe ingredients as structured rows, not prose: <https://www.mediawiki.org/wiki/Extension:Cargo> and <https://www.mediawiki.org/wiki/Help:Multiple-instance_templates>.
- OSRS Infobox Item template — uses Lua-backed structured fields, variant versioning, stable hash links, and Bucket output, which is a strong precedent for canonical item pages with explicit variants and queryable facts: <https://oldschool.runescape.wiki/w/Template:Infobox_Item>.
- Path of Exile modifier documentation — separates local item-property effects from global/conditional character effects, a useful model for Ardenfall state decisions: <https://www.poewiki.net/wiki/Modifier>.
- OSRS Combat bracelet page — demonstrates explicit charged variants, item IDs, combat stats, creation/products, teleport options, price-per-use, and recommended-equipment backlinks on one item page: <https://oldschool.runescape.wiki/w/Combat_bracelet>.
- Terraria modifiers page — documents modifier state, tooltip display behavior, exact-vs-displayed rounding caveats, and which item classes can receive which modifier categories: <https://terraria.wiki.gg/wiki/Modifiers>.
- GOV.UK Design System contribution criteria and documentation process — components should be useful, unique, usable, consistent, versatile, documented with when/when-not-to-use guidance, and honest about known issues: <https://design-system.service.gov.uk/community/contribution-criteria/> and <https://designnotes.blog.gov.uk/2018/11/05/how-we-document-components-and-patterns-in-the-gov-uk-design-system/>.
- Storybook documentation, interaction testing, accessibility testing, and visual testing docs — stories/examples double as documentation and tests; accessibility/visual tooling is valuable when maintained, but should be introduced when it has a clear role: <https://storybook.js.org/docs/writing-docs>, <https://storybook.js.org/docs/writing-tests>, <https://storybook.js.org/docs/writing-tests/accessibility-testing>, and <https://storybook.js.org/docs/writing-tests/visual-testing>.
- Design Tokens Community Group format and Tailwind theme-variable docs — design tokens are named, typed design decisions; Tailwind v4 exposes CSS theme variables as the design-token API for utilities: <https://www.designtokens.org/tr/drafts/format/> and <https://tailwindcss.com/docs/theme>.
- shadcn-svelte and Bits UI docs — shadcn-svelte is an owned-code approach for building a project component library on top of accessible, headless Svelte primitives: <https://www.shadcn-svelte.com/docs> and <https://www.bits-ui.com/docs/introduction>.
- WAI-ARIA Authoring Practices and Playwright accessibility testing docs — interactive components need keyboard/focus/semantic patterns, and automated axe scans catch only part of accessibility correctness: <https://www.w3.org/WAI/ARIA/apg/> and <https://playwright.dev/docs/accessibility-testing>.
- AGENTS.md and llms.txt conventions — agent-specific guidance and curated machine-readable documentation help coding agents find canonical project patterns instead of guessing from route-local examples: <https://agents.md/> and <https://llmstxt.org/>.
