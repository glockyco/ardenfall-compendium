# Slice 4.5 — Items deterministic presentation closure

**Status:** drafting
**Author:** OMP agent
**Date:** 2026-05-20
**Supersedes / extends:**

- `docs/superpowers/specs/2026-05-19-item-presentation-depth-design.md` (Slice 4)
- `docs/superpowers/specs/2026-05-15-tooltip-and-ui-surface-audit.md`
- `docs/superpowers/specs/2026-05-14-item-icon-tooltip-audit.md`
- `docs/superpowers/specs/2026-04-29-ardenfall-compendium-implementation-decisions.md`
- `docs/superpowers/roadmap.md` Slices 11 (spells) and parts of Slice 10 (cross-entity references) — pulled forward.

**Verified prior art used to ground the architecture:**

- Path of Building Community `ModParser.lua` + `src/Export/Scripts/` (composer-port discipline).
- MediaWiki `pagelinks` + Extension:Cargo (single backlink table over heterogeneous content at Wikipedia scale).
- Wowhead `wowhead.com/item=<id>/<kebab>` and dev.to `<slug>-<short-id>` (slug-with-short-id route shape).
- DoltHub & GW2 v2 API (type-tagged polymorphic record + JSON payload).
- SvelteKit `adapter-cloudflare` Static Assets hard cap of 100 `_routes.json` rules (must use wildcards, never per-id).
- Game decompile at `.decompiled/0.0.10.91-63c576261184/csharp/Ardenfall/`.

> Companion documents committed alongside this spec (audit trail of the work that informed it; may be retired if they go stale):
>
> - `docs/superpowers/specs/2026-05-20-item-asset-graph-audit.md` — exhaustive per-asset-type field inventory with decompile + adapter citations.
> - `docs/superpowers/specs/2026-05-20-compendium-architecture-survey.md` — survey of comparable open-source compendium projects (Path of Building, MediaWiki Cargo, GW2 API, tarkov.dev, Wowhead/dev.to slug shapes, SvelteKit prerender limits).
> - `docs/superpowers/specs/2026-05-20-items-presentation-closure-architecture-review.md` — oracle review of the pivot proposal, including rejected alternatives.

---

## 1. Summary

Today the compendium ships item detail pages and tooltip cards driven by `item_presentation_rows`, but the rendered content is partial: weapon/armor stats are missing "Heavy Attack Damage" / "Damage Threshold", consumables and potions render the placeholder `"Status effects status-effect"` instead of the in-game `"On Drink: Restores 150 Health for Self for 3 Seconds"`, item-type labels are variant slugs ("Melee weapon") instead of the game's labels ("Heavy Armor Skill"), icons are not tinted by `displayIconColor` even though the colour is captured, tag descriptions ("Incredibly valuable remedy") are missing, slate-spell items show no spell text at all, and item routes are `/items/<32-hex GUID>` rather than SEO-friendly slugs. The spec for Slice 4 deliberately punted on the entities items reference (status effects, spells, enchantments, stat types, item categories, item tags, potion recipes), assuming we could capture composed UI strings on the fly; in production this turned out to require Unity / player state and re-bakes TMP markup we just untangled.

This slice replaces that approach. We extract every deterministic dependency required to render and link items — items themselves are re-extracted to capture missing per-variant fields, plus seven new public entity types and one private vocabulary singleton are added — and we port the game's tooltip composition methods to TypeScript so the pipeline materialises `rich_text_v1` documents from typed atoms without ever instantiating Unity assets. The same canonical entities and composer power the new public detail pages for status effects, spells, enchantments, item categories, item tags, stat types, and potion recipes. URLs become `<plural>/<kebab-slug>--<id8>`, legacy GUID routes 301 to the new ones, and the relationship graph gains the recursive predicates needed for reverse pages ("items that apply this status effect", "recipes that produce this potion") without doubling edge rows.

After this slice, every public item page is feature-complete with respect to the in-game item details panel (modulo strictly player-dependent surfaces like equipped comparison) and every reference an item makes resolves to a public, indexable, internally linked entity.

---

## 2. Scope

### 2.1 Hard boundary

**In scope:** every asset, field, and reference required to deterministically render item detail pages and item tooltips with parity to the game's `ItemInfoListUI` chain, plus every link target those pages emit.

**Out of scope:** anything whose value is only meaningful with runtime player/world/inventory/merchant/repair-manager state, and anything reachable from item assets but not consumed by the item presentation contract:

- `Weather`, `CharacterData`, `Faction`, `TimeRangeAsset`, `RPGBalance.Instance` durability-scaled value math, `ItemHandStateHandler`, AI behaviour assets, audio (`ArdenAudioClip`), camera kicks, particle prefabs, mesh prefabs, material sounds, `ChoiceCheckEffect`, `FlowGraph`, `DialogStatementModifier`, `SpellInputMode` HUD overlays, `MasterSpellListAsset` generation knobs.
- `monsters`, `vendors`, `locations`, `quests`, `factions` — Slice 5+.
- Full-text search and Pagefind facets — Slice 10.
- Override mechanism — deferred.

The line is: **"a field is in scope iff `ItemInfoListUI.SetBasicStuff`, `BaseItem.GetEffectsTooltip` (and overrides), `BaseItem.GetItemStatInfos` (and overrides), or a composer that one of those calls transitively reads it from asset data without touching `PlayerCharacter`, `ArdenfallGame.instance` runtime state, or world singletons that are not `ArdenfallMasterData` / `PotionRecipeManager.potionRecipeDescription`."**

### 2.2 New entities

- `status-effect` (public, with detail pages)
- `spell` (public, with detail pages)
- `enchantment` (public, with detail pages)
- `stat-type` (public, with detail pages)
- `item-category` (public, with detail pages)
- `item-tag` (public, with detail pages — currently only ids are captured)
- `potion-recipe` (public, with detail pages)
- `master-tooltip-vocabulary` (**private** pipeline singleton; no public page, no graph node, no route)

### 2.3 Items re-extraction

Per-variant gap closure to drive the in-game stat rows, requirement lines, and durability fact. See §3.1.

### 2.4 New public site routes

`/items/[slug]`, `/items/variant/[variant]`, `/status-effects`, `/status-effects/[slug]`, `/spells`, `/spells/[slug]`, `/enchantments`, `/enchantments/[slug]`, `/categories`, `/categories/[slug]`, `/tags`, `/tags/[slug]`, `/stats`, `/stats/[slug]`, `/recipes`, `/recipes/[slug]`.

Legacy `/items/<32hex GUID>` paths and their previous canonical-slug variant from Slice 4 become permanent (301) redirects to the new canonical route.

### 2.5 Local site defects folded in

- Icon tint via the `displayIconColor` we already capture.
- "Canonical compendium state / Base item, no player or inventory context." block removed.
- Variant-slug item-type labels replaced by data-derived type labels.
- `ItemEffectList` placeholder rendering replaced by composed rich text.
- `ItemPresentationBuilder` heuristics replaced by data-driven facts (e.g. "Armor" → "Damage Threshold", "Mana cost multiplier" → "Mana Usage").

---

## 3. Source-grounded inventory of what's missing

Every claim cites a file + line.

### 3.1 Items themselves

| Gap                                                                                                                                      | Source-of-truth (game)                                                                                                                                                           | Currently extracted                                                                                                   | Required after slice                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EquipItemData.enchantments[]` / `builtInEnchantments[]`                                                                                 | `Item/EquipItemData.cs:20,23` consumed by `EquipItem.InitializeStaticEnchantments` (`Item/EquipItem.cs:161-181`) and `EquipItem.GetEffectsTooltip` (`Item/EquipItem.cs:437-456`) | None (`Adapters/ExtractEquipment.cs:12-17` drops both)                                                                | Each item exposes `enchantments: [{enchantmentRef, level, hidden}]` (asset arrays union; no runtime state mutation)                                                                                                                                                                                                                                                                                                                                                          |
| `EquipItemData.statType` as ref, not string                                                                                              | `Item/EquipItemData.cs:29` resolved by `EquipItem.GetMinimumStat` (`Item/EquipItem.cs:336-345`) and `MeleeItem.GetTooltipItemType` (`Item/MeleeItem.cs:516-519`)                 | Captured as `Object.ToString()` (asset name)                                                                          | `statTypeRef: SnapshotRef` to a `stat-type` entity                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `MeleeItemData` numeric fields beyond damage/critChance/durability                                                                       | `Item/MeleeItemData.cs:11-77` — all `Parameter<T>` accessors                                                                                                                     | `Adapters/ExtractMelee.cs:10-16` captures `damage`, `criticalHitChance`, `meleeDurabilityMax`, `canBlock` only        | Add `hardAttackDamMult` (heavy-attack-damage multiplier), `stunChance`, `bleedChance`, `pierceChance`, `stealthStunChance`, `critDamageMult`, `knockbackStrength`, `knockbackStrengthHard`, `stealthHitMultiplier`, `bleedMultiplier`, `hitStopTime`, `attributeType: StatType ref`, `bleedStatusEffect: LeveledStatusEffect`, `canParry`, `canBeParried`, `hardAttackStaminaMultiplier`, `quickAttackStaminaMultiplier`, `blockStaminaMultiplier`, `parryStaminaMultiplier` |
| `ArmorItemData.armorRating` rendered as "Damage Threshold", not "Armor"                                                                  | `ArmorItem.cs:115-122` (`ItemStatInfo.GetComparisonTooltip(... "Damage Threshold")`)                                                                                             | Rendered by site as "Armor" via builder fallback                                                                      | Pre-computed stat row label baked into `item_presentation_rows.stat_rows_json` so the site does not invent labels                                                                                                                                                                                                                                                                                                                                                            |
| `BowItemData.GetBasicDamageValue` (= `damage` with dam-mult), `BowItemData.bleedStatusEffect`, `bleedMultiplier`, `damageFalloff` series | `BowItemData.cs:12-52`, consumed by `BowItem.GetItemStatInfos` (`BowItem.cs:430-435`)                                                                                            | `ExtractBow.cs` captures most numeric fields; bleed status effect ref captured                                        | OK with current capture, add presentation-stat row plumbing                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `ThrowingItemData` and `ThrowingPotionData` already mostly captured                                                                      | `ThrowingItemData.cs:11-55`, `ThrowingPotionData.cs:9-27`                                                                                                                        | `ExtractThrowingItem.cs:15-37`, `ExtractThrowingPotion.cs:14-35`                                                      | OK; need composed presentation                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `SlateSpellItemData.spellData` resolves to canonical `spell` entity                                                                      | `SlateSpellItemData.cs:12,14` consumed by `SlateSpellItem.cs:179-241,283-286,413-419`                                                                                            | `ExtractSlateSpell.cs:14-24` captures `spellRef`, `spellName`, `level`, `secondaryLevel`, subspell _class names_ only | All slate-spell tooltip composition reads through the new `spell` entity; subspells and effects come from there                                                                                                                                                                                                                                                                                                                                                              |
| `ItemTag.description` + `tagName` (content, not just id)                                                                                 | `Item/ItemTag.cs:8-9` consumed by `BaseItem.GetEffectsTooltip` (`BaseItem.cs:139-153`)                                                                                           | Tag GUIDs only on items, no tag content                                                                               | Tag content lives on the new `item-tag` entity; item presentation resolves tag rows by ref                                                                                                                                                                                                                                                                                                                                                                                   |
| `BaseItem.GetTooltipItemType()` chain                                                                                                    | Various overrides (§4.2 of inventory) — all asset-only                                                                                                                           | Builder falls back to title-cased variant id                                                                          | Per-variant rule emitted in `item_presentation_rows.item_type` from data (see §6.5)                                                                                                                                                                                                                                                                                                                                                                                          |
| `BaseItem.GetItemStatInfos()` chain                                                                                                      | `BaseItem.cs:194-197` + per-variant overrides                                                                                                                                    | Hard-coded mapping of damage/armorRating/critChance in `ItemPresentationBuilder`                                      | Per-variant pre-computed rows in `item_presentation_rows.stat_rows_json` (see §6.5)                                                                                                                                                                                                                                                                                                                                                                                          |

### 3.2 Referent entities (each is a new public entity unless noted)

Every entity below has a public detail page and at least one outbound or inbound predicate in the relationship graph. Fields cited from `.decompiled/0.0.10.91-63c576261184/csharp/Ardenfall/`.

- **`stat-type`** — `StatType.cs:6-38`. Fields: `id`, `isAttribute: bool`, `statName`, `iconRef`, `iconColor: Color`, `statDescription`, `longStatDescription`, `affects: string[]`, `skillAffects: string[]`. Grouping (`attribute` vs `skill` vs `trait`) derived from `ArdenfallMasterData.allAttributes / allSkills / allTraits` (`ArdenfallMasterData.cs:171-175`). Predicates: items `requires_stat` → stat-type; spell `casts_through_stat` → stat-type; status-effect `modifies_stat` → stat-type (via `ModStatEffect.stat`).

- **`item-category`** — `ItemCategory.cs:14-221`. Fields: `categoryName`, `iconRef`, `defaultItemIconRef`, `categoryColor: Color`, `showInAllCategory: bool`, `columns: CategoryColumn[]` (each column carries `label`, `iconRef`, widths, alignment, `itemDataField`/`itemFunctionField` reflective names). Predicates: items `belongs_to_category` → item-category. `categoryColor` is the canonical source of the icon tint we currently drop.

- **`item-tag`** — `Item/ItemTag.cs:6-10`. Fields: `tagName`, `description`. Predicates: items `tagged_with` → item-tag; recipes `requires_tag` → item-tag.

- **`status-effect`** — `StatusEffectData.cs:65-161` plus `Effect` hierarchy (`Effect.cs:5-58` + ~40 subclasses) plus `StatusEffectTooltip.cs:6-31`. Fields: `statusEffectName`, `characterNameModifier`, `iconRef`, `tooltipTemplate: string`, `tooltipVariables: TooltipVarSnapshot[]`, `effects: EffectInstanceRef[]`, `modifyStatusEffects: ModifyEffectInfoSnapshot[]`, `color: AppliedColorSnapshot`, `enableSkinColor`, `skinColorAssetRef`, `skinColor: StatusEffectSkinColorSnapshot`, `skinColorImportance`, `customSkinColorColor`, `skinColorColor`, `isHostile`, `isNegative`, `isDisease`, `itemMoneyCost`, `minLevel`, `forceAppearIfInfiniteLifetime`, `onlyApplyToLifeMode: flags`, `isLegendary`, `aiType`. Effect payload: see §6.6. Predicates: applied_by ← item / spell / enchantment / status-effect (recursive); modifies → status-effect (recursive via `modifyStatusEffects`); modifies_stat → stat-type (via `ModStatEffect.stat`).

- **`spell`** — `SpellData.cs:71-138` plus `SpellEffect` hierarchy (~12 subclasses) plus `SpellTooltip.cs:8-70`. Fields: `spellName`, `iconRef`, `statTypeRef`, `manaCost: float`, `isIlligal: bool` (sic — game spelling preserved on the read-side), `color: AppliedColorSnapshot`, `useStatusEffectColorRef: SnapshotRef` (status-effect), `simpleColor: AppliedColorSnapshot`, `tooltipTemplate`, `tooltipVariables: TooltipSpellVarSnapshot[]`, `spells: SpellEffectInstanceRef[]`, `subSpells: [{name, effects: SpellEffectInstanceRef[]}]`, `spellEffectReferenceRef: SnapshotRef` (spell, inheritance), `quickUseCooldown / castCooldown / castHardCooldown: LeveledFloat`, `aiCooldownMultiplier`, `aiSpellType`. Predicates: cast_by ← item (via `SlateSpellItemData.spellData` and `secondarySpellData`); inherits_from → spell (via `spellEffectReference`); applies_status_effect → status-effect (via spell effects); requires_stat → stat-type (via `statType`).

- **`enchantment`** — `Item/EnchantmentData.cs:5-79` plus `EnchantmentEffect` hierarchy (~10 subclasses) plus `EnchantmentTooltip.cs:9-67`. Fields: `enchantmentName`, `iconRef`, `enchantmentIconColor: Color`, `moneyValue`, `hideEffectTooltips: bool`, `showEnchantmentColor`, `enableEnchantmentMesh`, `enableCustomEnchantmentColor`, `customEnchantmentColor`, `customEnchantmentColorImportance`, `baseItemDataFilterBlacklistRefs: itemRef[]`, `baseItemDataFilterWhitelistRefs: itemRef[]`, `tooltipTemplate`, `tooltipVariables: TooltipEnchVarSnapshot[]` (with `targetVars` for per-item-type wholesale overrides), `effects: EnchantmentEffectInstanceRef[]`. Predicates: granted_by ← item (via `EquipItemData.enchantments` / `builtInEnchantments`); applies → status-effect (via `StatusEffectEnchantmentEffect`, `TriggerOnDamageEnchantmentEffect`); cascades → enchantment (via `TimedEnchantmentEffect.enchantmentToApply`); blacklists / whitelists → item (via `baseItemDataFilter*`).

- **`potion-recipe`** — `Item/PotionRecipe.cs:7-107` + `Item/RecipeItem.cs:6-26`. Fields: `recipeName: string | null` (derived from first produced potion's `GetEffectName()` per `PotionRecipe.cs:32-39`), `drinkablePotionRefs: itemRef[]`, `throwingPotionRefs: itemRef[]`, `lockedByDefault`, `enableSkillRequirement`, `skillRequirement`, `levelModifier`, `successModifier`, `ingredients: [{tagRef, count}]`. Predicates: teaches ← item (via `PotionRecipeItemData.recipe`); produces_potion → item (drinkable + throwing); requires_tag → item-tag (via ingredients).

- **`master-tooltip-vocabulary` (private)** — `ArdenfallMasterData.cs:84-160,184-188` + `PotionRecipeManager.cs:20-30` (the `(Learned)` suffix and recipe description format string). Fields: `tooltipCodes: {code, text}[]`, `tooltipColors: {code, color, text}[]`, `tooltipTargetColor: Color`, `tooltipDurationColor: Color`, `positiveColor`, `negativeColor`, `spellSubEffectColor`, `enchantmentItemColor`, `primarySpellTooltip: string` (prefix), `secondarySpellTooltip: string` (prefix), `unmetSkillMessage`, `brokenDurabilityMessage`, `ruinedDurabilityMessage`, `statBookMessage`, `termSetColors: TermSetColorSnapshot[]` (`categoryId`, replacement wrappers, journal override wrappers, parse `start`/`end` delimiters), `globalTermSets: TermSetSnapshot[]` (`categoryId`, `tooltipFormat`, raw `Term.value`/`definition` pairs), `termColorMatch: string`, `potionRecipeDescription: string` (from `PotionRecipeManager`). Stored under `fixtures/.../snapshot/master-tooltip.json` and the live equivalent; loaded once per pipeline run, available to every composer. No graph node, no public page.

### 3.3 Composer chain (the two-pass colour expansion the current pipeline misses)

| Pass                                                        | Source                                                                                              | What it does                                                                                                                                                                                                                                  | Currently ported?                                                                                                                                 |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1                                                           | `StringTooltip.ApplyColors` (`StringTooltip.cs:54-74`)                                              | Substitutes `tooltipCodes`, `tooltipColors`, `tooltipTargetColor`, `tooltipDurationColor`, `positiveColor`, `negativeColor` into `{tag}` markers                                                                                              | Partially — `pipeline/src/rich-text/rich-text-v1.ts:137-169` handles tooltipCodes/tooltipColors but not target/duration/positive/negative colours |
| 2                                                           | `ArdenfallMasterData.ApplyColorCodes` (`ArdenfallMasterData.cs:229-268`)                            | Term-set regex sweep + `<link>` substitution against `termSetColors` and `globalTermSets`                                                                                                                                                     | Not ported                                                                                                                                        |
| Spell prefix                                                | `SpellData.GetTooltip` (`SpellData.cs:223-237`)                                                     | Prepends `primarySpellTooltip` or `secondarySpellTooltip`, wraps sub-tooltips in `spellSubEffectColor`                                                                                                                                        | Not ported                                                                                                                                        |
| Stack-mode-aware status-effect composition                  | `LeveledLeveledStatusEffect.GetLeveledStatusEffect(level)` (`LeveledLeveledStatusEffect.cs:24-27`)  | Resolves a typed level/lifetime/stackMode tuple before tooltip composition                                                                                                                                                                    | Not ported                                                                                                                                        |
| Enchantment item-target override                            | `EnchantmentTooltip.GetTooltip` (`EnchantmentTooltip.cs:43-58`)                                     | If `targetVars` matches the item type, the template is REPLACED wholesale; no reflective substitution fallback                                                                                                                                | Not ported                                                                                                                                        |
| `hideEffectTooltips` / `hideEnchantmentTooltip` suppression | `EnchantmentData.GetTooltip` (`EnchantmentData.cs:54-79`), `StatusEffectEnchantmentEffect.cs:62-69` | Suppresses entire sub-tooltip line                                                                                                                                                                                                            | Not ported                                                                                                                                        |
| Reflection grammar                                          | `StringTooltip.GetValueFromField` (`StringTooltip.cs:90-204`)                                       | Field → property → method fallback; `isPercentage`/`oneMinus`/`invert`/`absoluteValue`/`roundToTenths`/`isInt`/`multiplier`/`add` transforms; recursive `LeveledStatusEffect` field expansion; list-value overwriting (not joining) semantics | Not ported                                                                                                                                        |

---

## 4. Architecture

### 4.1 Entity set

Eight entity types plus one private singleton:

| Entity                      | Public page | Slug shape                      | Snapshot artifact                                | Canonical table                                 | Read-model table                                                 |
| --------------------------- | ----------- | ------------------------------- | ------------------------------------------------ | ----------------------------------------------- | ---------------------------------------------------------------- |
| `item`                      | yes         | `/items/<slug>--<id8>`          | `items.json` (already exists, enriched)          | `items` etc.                                    | `item_overview_rows`, `item_presentation_rows`                   |
| `status-effect`             | yes         | `/status-effects/<slug>--<id8>` | `status-effects.json` (new)                      | `status_effects`                                | `status_effect_overview_rows`, `status_effect_presentation_rows` |
| `spell`                     | yes         | `/spells/<slug>--<id8>`         | `spells.json` (new)                              | `spells`                                        | `spell_overview_rows`, `spell_presentation_rows`                 |
| `enchantment`               | yes         | `/enchantments/<slug>--<id8>`   | `enchantments.json` (new)                        | `enchantments`                                  | `enchantment_overview_rows`, `enchantment_presentation_rows`     |
| `item-category`             | yes         | `/categories/<slug>--<id8>`     | `item-categories.json` (new)                     | `item_categories`                               | `item_category_overview_rows`, `item_category_presentation_rows` |
| `item-tag`                  | yes         | `/tags/<slug>--<id8>`           | `item-tags.json` (new)                           | `item_tags` (rename of existing relational tag) | `item_tag_overview_rows`, `item_tag_presentation_rows`           |
| `stat-type`                 | yes         | `/stats/<slug>--<id8>`          | `stat-types.json` (new)                          | `stat_types`                                    | `stat_type_overview_rows`, `stat_type_presentation_rows`         |
| `potion-recipe`             | yes         | `/recipes/<slug>--<id8>`        | `potion-recipes.json` (new)                      | `potion_recipes`                                | `potion_recipe_overview_rows`, `potion_recipe_presentation_rows` |
| `master-tooltip-vocabulary` | **NO**      | —                               | `master-tooltip.json` (already exists, extended) | `master_tooltip_vocabulary` (single row)        | — (never on read-model)                                          |

### 4.2 Master-tooltip vocabulary (singleton)

Single snapshot artifact + single-row pipeline canonical table + zero read-model tables. The pipeline loads it once into a `MasterTooltipVocabulary` value object, passes it into every composer, and never persists user-facing fields about it. The vocabulary is required to render any tooltip; absence is a fatal pipeline diagnostic.

Schema (TypeScript snapshot):

```ts
export interface MasterTooltipVocabulary {
  schemaVersion: 2;
  tooltipCodes: Record<string, string>;
  tooltipColors: Record<string, { color: string; text: string }>;
  tooltipTargetColor: ColorSnapshot;
  tooltipDurationColor: ColorSnapshot;
  positiveColor: ColorSnapshot;
  negativeColor: ColorSnapshot;
  spellSubEffectColor: ColorSnapshot;
  enchantmentItemColor: ColorSnapshot;
  primarySpellTooltip: string;
  secondarySpellTooltip: string;
  unmetSkillMessage: string;
  brokenDurabilityMessage: string;
  ruinedDurabilityMessage: string;
  statBookMessage: string;
  termSetColors: TermSetColorSnapshot[];
  globalTermSets: TermSetSnapshot[];
  termColorMatch: string;
  potionRecipeDescription: string;
  allAttributes: string[];
  allSkills: string[];
  allTraits: string[];
}

export interface TermSetColorSnapshot {
  categoryId: string;
  replaceWithStart: string;
  replaceWithEnd: string;
  enableJournalOverride: boolean;
  replaceWithStartJournal: string;
  replaceWithEndJournal: string;
  start: string;
  end: string;
}

export interface TermSetSnapshot {
  setId: string;
  categoryId: string;
  tooltipFormat: string;
  terms: TermSnapshot[];
}

export interface TermSnapshot {
  value: string;
  definition: string;
}
```

### 4.3 Composer port

A new `pipeline/src/composer/` library — pure TypeScript, no IO, deterministic — ports the game's tooltip composition methods. Inputs are the typed snapshots described in §6; outputs are `RichTextV1` documents plus structured atoms.

Modules:

- `string-tooltip.ts` — port of `StringTooltip.GetValueFromField` (`StringTooltip.cs:90-204`) and `StringTooltip.ApplyColors` (`StringTooltip.cs:54-74`).
- `master-data.ts` — port of `ArdenfallMasterData.ApplyColorCodes` (`ArdenfallMasterData.cs:229-268`) — term-set regex sweep + link substitution.
- `status-effect-tooltip.ts` — port of `StatusEffectTooltip.GetTooltip` (`StatusEffectTooltip.cs:14-31`) + `StatusEffectData.GetTooltip` (`StatusEffectData.cs:180-183`).
- `spell-tooltip.ts` — port of `SpellTooltip.GetTooltip` (`SpellTooltip.cs:28-67`) + `SpellData.GetTooltip` (`SpellData.cs:181-244`).
- `enchantment-tooltip.ts` — port of `EnchantmentTooltip.GetTooltip` (`EnchantmentTooltip.cs:30-62`) + `EnchantmentData.GetTooltip` (`EnchantmentData.cs:54-79`).
- `item-presentation.ts` — orchestrator: given an item entity + its referenced status-effect/spell/enchantment/category/tag/stat-type entities + the vocabulary, produces a populated `item_presentation_rows` payload.
- `effect-payload.ts` — typed accessor: `(effectKind, payloadJson, variableName, transforms) → number | string | nestedTooltip`. Replicates `StringTooltip.GetValueFromField`'s reflection chain (field → property → method), `isPercentage`/`oneMinus`/`invert`/`absoluteValue`/`roundToTenths`/`isInt`/`multiplier`/`add` transforms, list-overwrite semantics, and recursive `LeveledStatusEffect`/`LeveledLeveledStatusEffect` expansion.

The composer is a pure function of `(entitySnapshots, vocabulary)`; the pipeline stage `compose-presentations` wires it up and persists results.

**Composer is the source of truth for tooltip rendering.** The site never composes — it consumes pre-composed `RichTextV1` plus structured atoms.

### 4.4 Effect-instance representation

Single canonical `effect_instances` table, type-tagged. Per oracle's recommendation and confirmed against DoltHub's polymorphic-data pattern + GW2's `details` shape:

```sql
CREATE TABLE effect_instances (
  effect_id           TEXT PRIMARY KEY,    -- "<owner_type>:<owner_id>:<owner_scope>:<index>"
  owner_type          TEXT NOT NULL,       -- 'status-effect' | 'spell' | 'enchantment'
  owner_id            TEXT NOT NULL,
  owner_scope         TEXT NOT NULL,       -- 'status-effect-effects' | 'spell-spells' | 'spell-subspell-<i>' | 'enchantment-effects'
  effect_index        INTEGER NOT NULL,
  effect_kind         TEXT NOT NULL,       -- 'DamageEffect' | 'ModStatEffect' | 'StatusEffectEnchantmentEffect' | ...
  payload_json        TEXT NOT NULL,       -- validated per-kind Zod schema
  FOREIGN KEY (owner_type, owner_id) REFERENCES entity_nodes(entity_type, entity_id)
);

CREATE INDEX idx_effect_owner ON effect_instances (owner_type, owner_id, owner_scope, effect_index);
CREATE INDEX idx_effect_kind  ON effect_instances (effect_kind);
```

A per-kind Zod schema lives next to the composer (`pipeline/src/composer/effect-kinds/<kind>.zod.ts`). The composer reads `effect_kind` to dispatch, then `payload_json` for parameter access via the variable-name reflection rules.

Outbound refs from each effect (status-effect → status-effect via `AddEffectOnWeatherEffect.statusEffect`, spell-effect → status-effect via `StatusEffectTooltipSpellEffect.statusEffects`, etc.) are emitted into `entity_edges` separately so reverse lookups stay cheap.

### 4.5 Relationship graph

Single canonical `entity_edges` table, dual indexes, dual materialised sections.

```sql
CREATE TABLE entity_edges (
  edge_id        TEXT PRIMARY KEY,         -- "<source_type>:<source_id>:<predicate>:<target_type>:<target_id>"
  source_type    TEXT NOT NULL,
  source_id      TEXT NOT NULL,
  target_type    TEXT NOT NULL,
  target_id      TEXT NOT NULL,
  predicate      TEXT NOT NULL,
  label          TEXT NOT NULL,
  weight         REAL NOT NULL,
  evidence_json  TEXT NOT NULL,            -- { sourceField, slot, ownerScope, effectIndex?, ... }
  anchor         TEXT,
  FOREIGN KEY (source_type, source_id) REFERENCES entity_nodes(entity_type, entity_id),
  FOREIGN KEY (target_type, target_id) REFERENCES entity_nodes(entity_type, entity_id)
);

CREATE INDEX idx_edges_source ON entity_edges (source_type, source_id, predicate);
CREATE INDEX idx_edges_target ON entity_edges (target_type, target_id, predicate);
```

Forward sections (current Slice 4 behaviour) are materialised from the source-side index. Reverse sections (new) are materialised from the target-side index by the same `build-graph` stage; we do NOT double the edge rows.

Predicate vocabulary (final list for this slice):

- `item.variant_of → item-variant` (existing)
- `item.belongs_to_category → item-category`
- `item.tagged_with → item-tag`
- `item.requires_stat → stat-type`
- `item.applies_status_effect → status-effect` (consumable, throwing-potion, bleed status on weapons, on-hit enchantment status)
- `item.casts_spell → spell` (slate-spell primary + secondary)
- `item.grants_enchantment → enchantment` (equipment static + builtin)
- `item.teaches_recipe → potion-recipe` (potion-recipe item)
- `item.references_term → master-tooltip-term` (description term-set match; remains as Slice 4)
- `status-effect.modifies_status_effect → status-effect` (recursive via `modifyStatusEffects`)
- `status-effect.modifies_stat → stat-type` (via `ModStatEffect.stat`)
- `status-effect.applies_status_effect → status-effect` (via `AddEffectOnWeatherEffect`, `RerouteStatusEffectToCompanionEffect`)
- `status-effect.references_enchantment → enchantment` (via `EnchantmentLevelEffect.enchantmentFilter`)
- `spell.requires_stat → stat-type`
- `spell.inherits_from_spell → spell` (via `spellEffectReference`)
- `spell.applies_status_effect → status-effect` (via spell effects)
- `spell.uses_status_effect_color → status-effect` (via `SpellData.useStatusEffectColor`)
- `enchantment.applies_status_effect → status-effect` (via `StatusEffectEnchantmentEffect`, `TriggerOnDamageEnchantmentEffect`)
- `enchantment.cascades_to_enchantment → enchantment` (via `TimedEnchantmentEffect`)
- `enchantment.blacklists_item → item`
- `enchantment.whitelists_item → item`
- `enchantment.target_override → item` (per `EnchantmentTooltip.targetVars`)
- `potion-recipe.produces_drinkable_potion → item`
- `potion-recipe.produces_throwing_potion → item`
- `potion-recipe.requires_tag → item-tag`

The reverse rendering on a page like `/status-effects/[slug]` shows sections "Items that apply this", "Spells that apply this", "Enchantments that apply this", "Status effects that modify this", "Recipes that produce …" by querying `idx_edges_target` for `(target_type='status-effect', target_id=$id)` grouped by predicate.

### 4.6 Slug + redirect strategy

**Canonical route shape:** `<plural>/<kebab-slug>--<id8>` where `id8` is the first 8 lowercase hex characters of the asset GUID, before the `.11400000` Unity sub-id suffix.

- Slug is generated from the entity's display name with a deterministic kebab transform (lowercase ASCII, non-alphanumeric → `-`, collapse runs, strip leading/trailing `-`).
- `id8` is fixed across slug renames; collision-free as verified against the 1,273-item snapshot.
- The route resolver is `id8`-primary: if `id8` resolves, redirect to the current canonical `<slug>--<id8>` (301 permanent); if it does not, 404. Slug-only routes are NOT supported.
- `entity_nodes` gains a `short_id` column (the `id8`) with a unique constraint per entity type.
- `entity_redirects` (already exists) carries (`from_route → to_route`, `reason`). Two predicates this slice writes:
  - Legacy GUID route: `/items/<32hex>.11400000 → /items/<slug>--<id8>` (reason `legacy-id`).
  - Slug change (across patches): old `/items/<old-slug>--<id8> → /items/<new-slug>--<id8>` (reason `name-changed`). Same `id8`, so existing inbound links never break.
- Slug substitution for template names: `SlateSpellItemData.GetItemName()` (`SlateSpellItemData.cs:43-54`) and `ThrowingPotionData.GetItemName()` (`ThrowingPotionData.cs:62-71`) use `{lvl}` / `{name}` templates. The pipeline runs the same substitution against `LeveledSpellData.level` / `spellData.spellName` and `areaOfEffect[0].StatusEffect.statusEffectName + romanLevel` before slugifying.
- Disambiguation by parenthetical names (OSRS-style) is rejected — it depends on MediaWiki auto-redirect that we don't have, and forces server-side URL decoding logic.

### 4.7 Site routes

| Route                             | Type                                                   | Source                                     |
| --------------------------------- | ------------------------------------------------------ | ------------------------------------------ |
| `/items`                          | prerendered overview                                   | existing                                   |
| `/items/[id]` (legacy)            | runtime 301                                            | redirect via `entity_redirects`            |
| `/items/[slug]` (`<slug>--<id8>`) | prerendered detail                                     | `item_presentation_rows`                   |
| `/items/variant/[variant]`        | prerendered category                                   | existing                                   |
| `/status-effects`                 | prerendered overview                                   | `status_effect_overview_rows`              |
| `/status-effects/[slug]`          | prerendered detail                                     | `status_effect_presentation_rows`          |
| `/spells`                         | prerendered overview                                   | `spell_overview_rows`                      |
| `/spells/[slug]`                  | prerendered detail                                     | `spell_presentation_rows`                  |
| `/enchantments`                   | prerendered overview                                   | `enchantment_overview_rows`                |
| `/enchantments/[slug]`            | prerendered detail                                     | `enchantment_presentation_rows`            |
| `/categories`                     | prerendered overview                                   | `item_category_overview_rows`              |
| `/categories/[slug]`              | prerendered detail                                     | `item_category_presentation_rows`          |
| `/tags`                           | prerendered overview                                   | `item_tag_overview_rows`                   |
| `/tags/[slug]`                    | prerendered detail                                     | `item_tag_presentation_rows`               |
| `/stats`                          | prerendered overview, grouped by attribute/skill/trait | `stat_type_overview_rows` + grouping table |
| `/stats/[slug]`                   | prerendered detail                                     | `stat_type_presentation_rows`              |
| `/recipes`                        | prerendered overview                                   | `potion_recipe_overview_rows`              |
| `/recipes/[slug]`                 | prerendered detail                                     | `potion_recipe_presentation_rows`          |
| `/terms/[id]`                     | prerendered (existing)                                 | `entity_nodes` term rows                   |

**Cloudflare `_routes.json`:** per the librarian's call-out, expressed as plural wildcards (`/items/*`, `/status-effects/*`, `/spells/*`, `/enchantments/*`, `/categories/*`, `/tags/*`, `/stats/*`, `/recipes/*`, `/terms/*`, `/assets/*`, `/_release.json`) — never per-id. Hard cap of 100 include+exclude rules combined ([sveltejs/kit#7298](https://github.com/sveltejs/kit/issues/7298)).

**Page count budget:** snapshot has 1,273 items + ~500 status-effects (estimated; runtime audit will confirm) + ~280 spells + ~50 enchantments + ~30 categories + ~100 tags + ~20 stat-types + ~50 recipes = ~2,300 prerendered detail pages plus overviews. SvelteKit prerender will need `NODE_OPTIONS=--max-old-space-size=8192` per [sveltejs/kit#5233](https://github.com/sveltejs/kit/issues/5233).

### 4.8 Icon tinting and local site fixes

- `ItemIcon.svelte` applies `displayIconColor` using CSS `background-color` + `mix-blend-mode: multiply` over the bitmap (browser-supported pattern, fast on Cloudflare Static Assets, no JS). For monochrome glyph fallbacks where the icon is already pure-white-on-alpha, switch to `mask-image: url(<icon>)` with `background-color: <tint>`.
- "Canonical compendium state / Base item, no player or inventory context." is removed from the public schema. If we need an internal marker, it lives in `pipeline_diagnostics` only.
- "Status effects status-effect" placeholder is removed; `ItemEffectList.svelte` consumes pre-composed rich-text from `effects_source_rich_text_json` (already exists since Slice 4 patch) plus typed `effect_facts_json` for structured chips ("On Drink", "On Hit", "On Consume" headers come from the composer, not the component).
- Variant title-case fallback removed from `ItemPresentationBuilder`. Item type label is sourced from per-variant data rules (see §6.5).
- Stat row labels come from `item_presentation_rows.stat_rows_json` (e.g. `"Damage Threshold"` for armor, `"Heavy Attack Damage"` for melee), not from a hard-coded site map.

---

## 5. Sequencing

Ordered to never push a half-resolved link into production. Each milestone ends with a verified release candidate (fixture build + tests + smoke), but only the final milestone deploys.

1. **Master-tooltip vocabulary v2** — extend mod export, pipeline contract, fixture, and `MasterTooltipDictionary` → `MasterTooltipVocabulary`. Pipeline composer-port stub compiles. No site change.
2. **`stat-type`, `item-category`, `item-tag` entities** — mod export, snapshot DTOs, canonical tables, read-model tables, slug + redirect machinery generalised across all entity types, public pages. Items re-extracted to resolve `statTypeRef` and per-tag refs; old text-only tag list deprecated. Detail pages live but item presentation does not link to them yet (graph relinking still runs in step 7).
3. **`status-effect` entity + composer port** — mod export of `StatusEffectData` + all `Effect` subclasses' fields actually referenced by templates (see §7.7 runtime audit), `effect_instances` table, Zod payload schemas, `string-tooltip.ts` + `status-effect-tooltip.ts` ported, golden-file parity tests (§7.6) for a fixture set, public `/status-effects` pages live, recursive `modifies_status_effect` edges emitted.
4. **`spell` entity + composer port** — mod export of `SpellData` + all `SpellEffect` subclasses, `spell-tooltip.ts` ported with primary/secondary level + subspell indexing + spell-prefix wrap + `spellSubEffectColor`, golden-file tests, public `/spells` pages live.
5. **`enchantment` entity + composer port** — mod export of `EnchantmentData` + all `EnchantmentEffect` subclasses, `enchantment-tooltip.ts` ported with `targetVars` wholesale replacement + `hideEffectTooltips` / `hideEnchantmentTooltip` suppression, golden-file tests, public `/enchantments` pages live.
6. **`potion-recipe` entity** — mod export, recipe name derivation (incl. `(Learned)` suffix stub for compendium static), public `/recipes` pages live.
7. **Item re-extraction + presentation re-cut + relationship graph rebuild** — equipment enchantment arrays, melee/armor field catch-up, item-type label rule, pre-computed `stat_rows_json`, edges relinked to canonical entity routes, reverse sections materialised. The graph audit (`auditEntityGraph`) is upgraded to fail any edge whose target slug is not on the new canonical scheme.
8. **Slug + redirect cutover** — `entity_nodes.route_path` and `canonical_slug` switched to `<slug>--<id8>` for every entity type; `entity_redirects` populated with legacy `/items/<guid>` mappings; SvelteKit route files updated; Cloudflare `_redirects` file emitted from `entity_redirects`; live release validation.

Each milestone is a separate plan step in `docs/superpowers/plans/2026-05-20-items-presentation-closure.md` (the next document).

---

## 6. Data shapes

### 6.1 Mod snapshot DTOs (C#)

Add to `mod/src/Entities/Item/`:

- `StatTypeSnapshot.cs` — id, isAttribute, statName, iconRef, iconColor (existing `AssetColorSnapshot`), statDescription, longStatDescription, affects, skillAffects.
- `ItemCategorySnapshot.cs` — id, categoryName, iconRef, defaultItemIconRef, categoryColor, showInAllCategory, columns: `ItemCategoryColumnSnapshot[]` (each: label, iconRef, preferedWidth, flexibleWidth, alignment, itemDataField, itemFunctionField, plus the boolean flags).
- `ItemTagSnapshot.cs` — id, tagName, description.
- `StatusEffectSnapshot.cs` — id, statusEffectName, characterNameModifier, iconRef, tooltipTemplate, tooltipVariables: `TooltipVarSnapshot[]`, effects: `EffectInstanceSnapshot[]`, modifyStatusEffects: `ModifyEffectInfoSnapshot[]`, color: `AppliedColorSnapshot`, enableSkinColor, skinColorAssetRef, skinColor: `StatusEffectSkinColorSnapshot`, skinColorImportance, customSkinColorColor, skinColorColor, isHostile, isNegative, isDisease, itemMoneyCost, minLevel, forceAppearIfInfiniteLifetime, onlyApplyToLifeMode (flags as string list), isLegendary, aiType.
- `SpellSnapshot.cs` — id, spellName, iconRef, statTypeRef, manaCost, isIlligal (preserved spelling), color, useStatusEffectColorRef, simpleColor, tooltipTemplate, tooltipVariables: `TooltipSpellVarSnapshot[]`, spells: `EffectInstanceSnapshot[]`, subSpells: `SubSpellSnapshot[]`, spellEffectReferenceRef, quickUseCooldown / castCooldown / castHardCooldown (LeveledFloat → `LeveledFloatSnapshot { base: float, levelScale: float? }`), aiCooldownMultiplier, aiSpellType.
- `EnchantmentSnapshot.cs` — id, enchantmentName, iconRef, enchantmentIconColor, moneyValue, hideEffectTooltips, showEnchantmentColor, enableEnchantmentMesh, enableCustomEnchantmentColor, customEnchantmentColor, customEnchantmentColorImportance, baseItemDataFilterBlacklistRefs, baseItemDataFilterWhitelistRefs, tooltipTemplate, tooltipVariables: `TooltipEnchVarSnapshot[]` (with `targetVars: [{itemRef, text}]`), effects: `EffectInstanceSnapshot[]`.
- `PotionRecipeSnapshot.cs` — id, recipeName, drinkablePotionRefs, throwingPotionRefs, lockedByDefault, enableSkillRequirement, skillRequirement, levelModifier, successModifier, ingredients: `RecipeIngredientSnapshot[]`.
- `MasterTooltipVocabularySnapshot.cs` — see §4.2.

`EffectInstanceSnapshot` is shared across status-effect/spell/enchantment effect lists:

```cs
public sealed record EffectInstanceSnapshot(
    [property: JsonProperty("kind")] string Kind,            // e.g. "DamageEffect", "ModStatEffect", "StatusEffectEnchantmentEffect"
    [property: JsonProperty("payload")] JObject Payload      // serialized via per-kind Newtonsoft contract resolver
);
```

Per-kind C# serializers (one per concrete subclass) live under `mod/src/Entities/Effects/{Status,Spell,Enchantment}/Snapshot<Kind>.cs` and produce a JObject of typed atoms (LeveledFloat → `{base, levelScale}`, LeveledLeveledStatusEffect → `{statusEffectRef, level: {base,scale}, lifetime: {base,scale}, stackMode}`, etc.). Outbound asset refs go through the existing `RefResolver`.

### 6.2 Pipeline snapshot envelopes

Each new entity has its own JSON file under the snapshot directory:

```
fixtures/synthetic/snapshot/
  manifest.json
  items.json           (existing, enriched)
  status-effects.json  (new)
  spells.json          (new)
  enchantments.json    (new)
  stat-types.json      (new)
  item-categories.json (new)
  item-tags.json       (new)
  potion-recipes.json  (new)
  master-tooltip.json  (existing, extended)
  asset-manifest.json  (existing)
  diagnostics.json     (existing)
```

Each envelope is `{ entityId, schemaVersion, rows: [...], diagnostics: [...] }` — same shape as the existing item envelope.

### 6.3 Pipeline canonical tables

One canonical table per entity per oracle's "denormalised page-ready storage" rule. Existing item canonical tables stay; new ones mirror the snapshot shape but with refs flattened into FK columns + JSON columns for nested structures.

```sql
CREATE TABLE stat_types (
  id                    TEXT PRIMARY KEY,
  is_attribute          INTEGER NOT NULL,
  stat_name             TEXT NOT NULL,
  icon_hash             TEXT,
  icon_color_json       TEXT,
  stat_description      TEXT,
  long_stat_description TEXT,
  affects_json          TEXT NOT NULL DEFAULT '[]',
  skill_affects_json    TEXT NOT NULL DEFAULT '[]',
  grouping              TEXT NOT NULL          -- 'attribute' | 'skill' | 'trait'
);

CREATE TABLE item_categories (
  id                    TEXT PRIMARY KEY,
  category_name         TEXT NOT NULL,
  icon_hash             TEXT,
  default_item_icon_hash TEXT,
  category_color_json   TEXT NOT NULL,
  show_in_all_category  INTEGER NOT NULL,
  columns_json          TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE item_tags (
  id                    TEXT PRIMARY KEY,
  tag_name              TEXT NOT NULL,
  description           TEXT NOT NULL
);

CREATE TABLE status_effects (
  id                    TEXT PRIMARY KEY,
  status_effect_name    TEXT NOT NULL,
  character_name_modifier TEXT,
  icon_hash             TEXT,
  tooltip_template      TEXT NOT NULL,
  tooltip_variables_json TEXT NOT NULL,
  modify_status_effects_json TEXT NOT NULL DEFAULT '[]',
  color_json            TEXT NOT NULL,
  skin_color_json       TEXT,
  flags_json            TEXT NOT NULL          -- isHostile, isNegative, isDisease, isLegendary, etc.
);

CREATE TABLE spells (
  id                    TEXT PRIMARY KEY,
  spell_name            TEXT NOT NULL,
  icon_hash             TEXT,
  stat_type_id          TEXT,
  mana_cost             REAL NOT NULL,
  is_illegal            INTEGER NOT NULL,
  color_json            TEXT NOT NULL,
  use_status_effect_color_id TEXT,
  simple_color_json     TEXT,
  tooltip_template      TEXT NOT NULL,
  tooltip_variables_json TEXT NOT NULL,
  sub_spells_json       TEXT NOT NULL DEFAULT '[]',
  spell_effect_reference_id TEXT,
  cooldowns_json        TEXT NOT NULL,
  FOREIGN KEY (stat_type_id) REFERENCES stat_types(id),
  FOREIGN KEY (use_status_effect_color_id) REFERENCES status_effects(id),
  FOREIGN KEY (spell_effect_reference_id) REFERENCES spells(id)
);

CREATE TABLE enchantments (
  id                    TEXT PRIMARY KEY,
  enchantment_name      TEXT NOT NULL,
  icon_hash             TEXT,
  enchantment_icon_color_json TEXT,
  money_value           REAL NOT NULL,
  hide_effect_tooltips  INTEGER NOT NULL,
  tooltip_template      TEXT NOT NULL,
  tooltip_variables_json TEXT NOT NULL,
  base_item_blacklist_json TEXT NOT NULL DEFAULT '[]',
  base_item_whitelist_json TEXT NOT NULL DEFAULT '[]',
  display_flags_json    TEXT NOT NULL
);

CREATE TABLE potion_recipes (
  id                    TEXT PRIMARY KEY,
  recipe_name           TEXT,                   -- nullable when invalid
  drinkable_potion_refs_json TEXT NOT NULL DEFAULT '[]',
  throwing_potion_refs_json  TEXT NOT NULL DEFAULT '[]',
  locked_by_default     INTEGER NOT NULL,
  enable_skill_requirement INTEGER NOT NULL,
  skill_requirement     INTEGER NOT NULL,
  level_modifier        REAL NOT NULL,
  success_modifier      REAL NOT NULL,
  ingredients_json      TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE master_tooltip_vocabulary (
  id                    TEXT PRIMARY KEY,        -- always 'singleton'
  schema_version        INTEGER NOT NULL,
  vocabulary_json       TEXT NOT NULL
);
```

Plus `effect_instances` (§4.4), `entity_nodes` / `entity_edges` / `entity_aliases` / `entity_redirects` / `entity_disambiguations` / `entity_relationship_sections` / `pipeline_diagnostics` (existing, indexes adjusted).

### 6.4 Read-model tables

One overview row + one presentation row per entity. Overview rows feed list pages and table-style displays; presentation rows feed detail pages. Per-entity:

```sql
CREATE TABLE status_effect_overview_rows (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  icon_hash           TEXT,
  icon_color          TEXT,
  flags_json          TEXT NOT NULL,
  display_color_json  TEXT NOT NULL
);

CREATE TABLE status_effect_presentation_rows (
  id                          TEXT PRIMARY KEY,
  name                        TEXT NOT NULL,
  render_context              TEXT NOT NULL,            -- 'status-effect-presentation-v1'
  display_icon_hash           TEXT,
  display_icon_color          TEXT,
  description_rich_text_json  TEXT NOT NULL,
  flags_json                  TEXT NOT NULL,            -- isHostile, isNegative, isDisease, isLegendary
  level_table_json            TEXT NOT NULL,            -- precomputed tooltip per minLevel..minLevel+N
  effects_summary_json        TEXT NOT NULL,            -- per-effect structured atoms for chips
  modify_status_effects_json  TEXT NOT NULL,
  diagnostics_json            TEXT NOT NULL
);
```

Spell, enchantment, item-category, item-tag, stat-type, potion-recipe follow the same overview + presentation pattern with their own column sets. Full DDL in `pipeline/src/sql/read-model-ddl.ts` (one constant per entity).

### 6.5 Item-presentation pre-computed atoms

`item_presentation_rows` carries everything the site needs to render a detail page or tooltip card. After this slice, it gains:

- `item_type: TEXT NOT NULL` — derived deterministically:
  - `ArmorItemData`: `statType.statName` (e.g. "Heavy Armor")
  - `MeleeItemData`: `statType.statName` (uses `EquipItemData.statType`, NOT `MeleeItemData.attributeType` — see `MeleeItem.cs:516-519`)
  - `BowItemData` / `ThrowingItemData`: `itemTypeTooltip`
  - `ArrowItemData`: constant `"Arrow"`
  - `SlateSpellItemData`: `spellData.spellData.statType.statName + (" Slate" | " Scroll" | " Stave")` per `SlateSpellItem.cs:283-286`
  - others: `null`
- `stat_rows_json: TEXT NOT NULL` — composed per-variant via `ItemStatInfos` rules:
  - `ArmorItem` → `[{id:"damage-threshold", label:"Damage Threshold", value: armorRating, isLarge:true}]`
  - `MeleeItem` → `[{id:"damage", label:"Damage", value: damage, isLarge:true}, {id:"heavy-attack-damage", label:"Heavy Attack Damage", value: damage*hardAttackDamMult, isLarge:true}]`
  - `BowItem` / `ArrowItem` / `ThrowingItem` → `[{id:"damage", label:"Damage", value: damage, isLarge:true}]`
  - `SlateSpellItem` → `[{id:"mana-usage", label:"Mana Usage", value: computedManaCost, isLarge:true}]` (computed from `spell.manaCost * slate.manaCostMultiplier` via the level math `StatCalculations.CalculateManaCost`; we port the formula since it's pure data)
  - `ThrowingPotion` → `[]` (game UI uses empty `GetItemStatInfos`)
  - others: `[]`
- `requirements_json: TEXT NOT NULL` — `[{statTypeId, statName, minimum}]` for equipment with `minimumSkill > 0`. Site renders as "Heavy Armor Skill: 6" without the colour band (which is player-state-dependent).
- `durability_json: TEXT` — `{kind, max, source}` (we never carry current durability).
- `effects_source_rich_text_json: TEXT NOT NULL` — `RichTextV1` output from the composer for `GetEffectsTooltip()`-equivalent text (e.g. `"On Drink: Restores 150 Health for Self for 3 Seconds. Incredibly valuable remedy."`). Composed from typed atoms; no UI calls.
- `effect_facts_json: TEXT NOT NULL` — structured chips for the effect block: `[{kind:"on-drink"|"on-consume"|"on-hit"|"on-throw"|"enchantment"|"tag", header:"On Drink:", targetRef?: SnapshotRef, lines: RichTextV1[]}]`.
- `state_facts_json: TEXT NOT NULL` — non-runtime facts only. The "Canonical compendium state" pseudo-fact is removed. Real members are facts like `{kind:"stackable", label:"Stackable", description:"Can be stacked in the inventory."}`, `{kind:"two-handed", label:"Two-handed"}`, `{kind:"quest-item", label:"Quest item"}`. Empty arrays are fine.
- `omissions_json` — kept only for diagnostics; the site no longer displays it (we just diagnose).
- `value: INTEGER`, `weight: REAL` — kept.
- `display_icon_hash`, `display_icon_color` — kept; site now applies the tint.

### 6.6 Effect payload schemas (per kind)

One Zod schema per concrete subclass. Examples:

```ts
// pipeline/src/composer/effect-kinds/ModStatEffect.zod.ts
export const ModStatEffectPayload = z.object({
  kind: z.literal("ModStatEffect"),
  stat: z.object({ ref: SnapshotRefSchema, statName: z.string() }),
  modification: LeveledFloatSchema,
  addition: z.boolean(),
});

// pipeline/src/composer/effect-kinds/DamageEffect.zod.ts
export const DamageEffectPayload = z.object({
  kind: z.literal("DamageEffect"),
  damageValue: LeveledFloatSchema,
  damageType: z.string(), // enum name string
});
```

A discriminated union `EffectPayload = z.discriminatedUnion("kind", [...])` collects them. The composer dispatches on `kind`.

For Slice 4.5 we ship Zod schemas for **the effect kinds referenced by item tooltips** (i.e. kinds whose fields any `Item*` tooltip template actually reads via `componentIndex + variableName`). Remaining kinds get an `unknown-effect` fallback payload (one diagnostic per occurrence) and full schemas land in their owning slice. See §7.7 for the runtime audit that identifies the required set.

---

## 7. Composer port specification

### 7.1 `string-tooltip.ts`

Ports `StringTooltip.GetValueFromField` and `StringTooltip.ApplyColors`.

```ts
export function getValueFromField(
  payload: unknown, // an EffectPayload object
  variable: TooltipVarSnapshot,
  vocabulary: MasterTooltipVocabulary,
  context: {
    level: number;
    lifetime: number;
    targetSelf: boolean;
    recurse: (nested: LeveledStatusEffectSnapshot, ctx: ComposerContext) => RichTextV1;
  },
): string;

export function applyColors(input: string, vocabulary: MasterTooltipVocabulary): string;
```

**Reflection grammar (exact port):** `variable.variableName` is resolved on `payload` by:

1. Field with that name (object property in our port; matches the C# field access via `FieldInfo`).
2. Property with that name (getter in our port via `Object.getOwnPropertyDescriptor` chain).
3. Method with that name (zero-arg function on the payload — we represent these as functions on the payload schema; e.g. `ModPerSecondEffect.TotalDeltaTooltip(level, duration)` becomes a property `totalDeltaTooltip` whose value is a function called by the composer).

Transforms applied in this order (matching `StringTooltip.cs:127-204`):

1. If field is a `LeveledFloat`, evaluate at `level` (or `secondaryLevel` per the variable's `usesSecondaryLevel`).
2. If field is a `LeveledStatusEffect` or `LeveledLeveledStatusEffect`, recurse into `context.recurse`.
3. If `isList`, list-overwrite semantics — last element wins (game behaviour, NOT join).
4. `multiplier`, `add`.
5. `oneMinus` ⇒ `1 - x`.
6. `invert` ⇒ `-x`.
7. `absoluteValue` ⇒ `|x|`.
8. `isPercentage` ⇒ multiply by 100, append `%`.
9. `isInt` ⇒ `Math.trunc`.
10. `roundToTenths` ⇒ `Math.round(x * 10) / 10`.

Golden-file tests will pin every quirk.

### 7.2 `master-data.ts`

Ports `ArdenfallMasterData.ApplyColorCodes`. Two-pass: regex sweep `termColorMatch` over the string, substituting matches against `termSetColors` and `globalTermSets`. Output is a `RichTextV1` node tree with term-link nodes resolved via the existing `resolveTerm` callback (Slice 4 mechanism).

### 7.3 `status-effect-tooltip.ts`

Ports `StatusEffectTooltip.GetTooltip` and the wrapping `StatusEffectData.GetTooltip`.

```ts
export function composeStatusEffectTooltip(
  statusEffect: StatusEffectSnapshot,
  level: number,
  lifetime: number,
  targetSelf: boolean,
  vocabulary: MasterTooltipVocabulary,
): RichTextV1;
```

Implementation:

1. `level = max(level, statusEffect.minLevel)` per `StatusEffectData.cs:140`.
2. Resolve each `tooltipVariable` against `effects[componentIndex]` via `getValueFromField`.
3. Substitute `{level}` / `{lifetime}` / `{target}` and `[lif ...]` regex segments per `StatusEffectTooltip.cs:25-30`.
4. `applyColors` first pass.
5. `applyColorCodes` second pass (term-set sweep).
6. Return `RichTextV1`.

### 7.4 `spell-tooltip.ts`

Ports `SpellTooltip.GetTooltip` + `SpellData.GetTooltip` exactly.

Key invariants:

- Variable resolution dispatches on `isSubspell` and `subspellEffectIndex` (`SpellTooltip.cs:39-52`).
- Each variable independently chooses primary vs secondary level via `usesSecondaryLevel` (`SpellTooltip.cs:10-19`).
- Sub-tooltips from `GetSubTooltips` are wrapped in `spellSubEffectColor` (`SpellData.cs:223-237`).
- Prefix `primarySpellTooltip` or `secondarySpellTooltip` depending on the caller's `SpellInputMode`.
- `SpellData.spellEffectReference` extends `Spells` via the `SpellData.Spells` getter — composer must walk the inheritance chain.

### 7.5 `enchantment-tooltip.ts`

Ports `EnchantmentTooltip.GetTooltip` + `EnchantmentData.GetTooltip`.

Critical behaviour:

- For each `tooltipVariable`, if `targetVars` contains an entry whose `itemRef` matches the rendering item, the **entire template is replaced** with `targetVar.text` — no reflective substitution fallback (`EnchantmentTooltip.cs:43-58`).
- `hideEffectTooltips` on `EnchantmentData` suppresses the sub-tooltip block.
- `hideEnchantmentTooltip` on `StatusEffectEnchantmentEffect` suppresses individual lines.
- Final `{level}` substitution + `applyColors` + `applyColorCodes`.

### 7.6 Golden-file parity tests

Mirror Path of Building's Alt-tooltip diagnostic discipline ([CONTRIBUTING.md](https://github.com/PathOfBuildingCommunity/PathOfBuilding/blob/dev/CONTRIBUTING.md)).

- Pin one **anchor patch** (current: `0.0.10.91-20260519`).
- For every status-effect, spell, enchantment, and every item that composes a tooltip from them, capture the in-game composed string (TMP markup intact) into a fixture under `fixtures/golden/<patch>/<entity-type>/<entity-id>.txt`. Initial population uses a one-off mod hook that calls `BaseItem.GetEffectsTooltip()` + `BaseItem.GetTooltipDescription()` + `GetTooltipItemType()` for each item and dumps the result; this hook is deleted once captures are baked.
- TypeScript test compares composer output (re-serialised back to TMP markup using a `rich_text_v1` → TMP roundtripper) against the golden file. Mismatches fail CI with a per-token diff.
- On patch upgrade, regenerate goldens + diff against the old set; the diff is the patch's tooltip changelog.

### 7.7 Effect-payload runtime audit

Because effect tooltip templates pick fields by string name at runtime, the set of fields any item tooltip actually references is not statically discoverable. We resolve this with a **one-time runtime audit** during mod implementation:

- A mod-side audit pass walks every `StatusEffectData`, `SpellData`, `EnchantmentData` asset and collects the union of `tooltipVariables[i].variableName` values per `effects[componentIndex].GetType().Name`.
- Output: `fixtures/audit/effect-variable-bindings.json` mapping `EffectKind → string[]` of variable names actually used.
- Zod schemas for §6.6 are required to cover every (kind, variableName) pair in that audit. Any variable name not covered emits a fatal pipeline diagnostic. The audit is re-run per patch upgrade.

---

## 8. Migration & cutover

### 8.1 Pipeline schema migration

Schema version bumps:

- `items.json` envelope: `schemaVersion` 2 → 3 (presentation atoms enriched).
- `status-effects.json` / `spells.json` / `enchantments.json` / `stat-types.json` / `item-categories.json` / `item-tags.json` / `potion-recipes.json`: `schemaVersion` 1 (new files).
- `master-tooltip.json`: `schemaVersion` 1 → 2.

Pipeline `validate.ts` rejects any snapshot whose envelopes don't match the supported versions; there is no read-side compatibility for older versions (clean cutover per project convention).

### 8.2 Site cutover

- `site/src/lib/server/read-models.ts` gains accessors for every new entity (`listStatusEffects`, `getStatusEffectPresentation`, etc.).
- `site/src/routes/items/[id]/+page.server.ts` swaps `[id]` to `[slug]` and resolves via `canonical_slug` (`<slug>--<id8>`).
- Legacy `/items/<32hex>.11400000` paths handled by a **runtime redirect handler** under `site/src/routes/items/[legacyId]/+page.server.ts` that 301s to the canonical route. The handler reads `entity_redirects` at build time so it is a static map; SvelteKit prerenders these as 301 HTML pages with `<meta http-equiv="refresh">` _and_ a `_redirects` file is emitted for Cloudflare Workers Static Assets to serve native 301s.
- The Cloudflare `_routes.json` is regenerated by the build to enumerate plural wildcards only.
- `ItemTooltipCard.svelte` and `ItemPresentationPanel.svelte` are rewritten to consume the new `effect_facts_json` + composed `effects_source_rich_text_json`.

### 8.3 Sitemap & SEO

- `scripts/build-sitemap-manifest.mjs` is extended to include every new entity's prerendered URL set.
- Each detail page emits minimal JSON-LD: `{"@context":"https://schema.org","@type":"Thing","name":"...","description":"...","image":"...","url":"...","isPartOf":{"@type":"VideoGame","name":"Ardenfall","url":"https://ardenfall.compendiums.org/"}}`. Per librarian's review, no rich-result type exists for in-game items; this is hygiene only.
- Open Graph + Twitter card meta are added if a page has a `display_icon_hash` for the `og:image`.
- `<link rel="canonical">` always points at `<slug>--<id8>`.

### 8.4 IndexNow / search engine notification

`scripts/indexnow-ping.mjs` already exists; extended to include the full new URL set on cutover deploy.

---

## 9. Risks & mitigations

| Risk                                                                                                                                                                      | Likelihood | Mitigation                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Composer reflection parity drift (the top regression flagged by oracle: `StringTooltip.GetValueFromField` is full of transform combinators that are easy to "tidy" wrong) | High       | Golden-file tests pin every entity's composed text against a captured in-game string for the anchor patch; tests fail on byte-level diff.                         |
| Spell composition inheritance bugs (`spellEffectReference.Spells` walk, `usesSecondaryLevel` per-variable)                                                                | Medium     | Golden tests cover every slate spell; runtime audit catalogues which spells use `spellEffectReference`.                                                           |
| `LeveledLeveledStatusEffect` / `StackMode` flattened too early                                                                                                            | Medium     | DTOs preserve the nested wrapper shape; composer never flattens until composition time; `LeveledFloatSnapshot` carries `{base, levelScale}`.                      |
| `EnchantmentTooltip.targetVars` wholesale replacement edge cases                                                                                                          | Medium     | Composer test fixture includes every (enchantment, target-item) pair the production snapshot exercises.                                                           |
| Master-tooltip vocabulary incomplete (term-set regex pass, spell prefixes)                                                                                                | High       | Mod-side extraction validated against `ArdenfallMasterData.cs:84-160` field set; pipeline validation rejects any missing key.                                     |
| 100-rule `_routes.json` cap                                                                                                                                               | Low        | All exclude rules are plural wildcards (`/items/*`, `/spells/*`, …); never per-id.                                                                                |
| 8 GB Node heap insufficient at 2,300+ pages                                                                                                                               | Medium     | CI prerender invoked with `NODE_OPTIONS=--max-old-space-size=8192`; if needed, shard the prerender by entity plural.                                              |
| Legacy `/items/<guid>` external inbound links break                                                                                                                       | High       | `entity_redirects` populated for every existing item id; runtime handler emits 301 with canonical destination. Verified by a smoke against a sample of guid URLs. |
| Audit `effect-variable-bindings.json` misses a runtime-only variable name                                                                                                 | Medium     | Pipeline emits a fatal diagnostic per unresolved (kind, variableName) so the composer cannot silently fall back to a default.                                     |
| Slug name template substitution misses corner cases (e.g. nested `{lvl}` in `{name}`)                                                                                     | Low        | Substitution mirrors `SlateSpellItemData.GetItemName()` exactly; tests cover all six known template subclasses.                                                   |
| Effect payload Zod validation rejects legitimate data                                                                                                                     | Medium     | Schemas validated against the live snapshot before pipeline gates close; diagnostic-only on first run; fatal on second run.                                       |

---

## 10. Acceptance criteria

This slice is "done" when **all** of the following are true:

1. **Every public item page is feature-complete with respect to the in-game `ItemInfoListUI` chain, modulo strictly player-dependent surfaces.**
   - Title, item-type label, skill requirement (without player-state colour band), durability max, all stat rows (per-variant), description rich-text, effects rich-text including "On Drink:" / "On Consume:" / "On Hit:" / "On Throw:" / "On Equip:" headers, tag descriptions, value, weight.
   - All references resolve to canonical entity routes; no inline ids or placeholder text.
2. **Every new entity has a prerendered detail page with composed rich-text content.** `/status-effects/<slug>--<id8>`, `/spells/<slug>--<id8>`, `/enchantments/<slug>--<id8>`, `/categories/<slug>--<id8>`, `/tags/<slug>--<id8>`, `/stats/<slug>--<id8>`, `/recipes/<slug>--<id8>`.
3. **Reverse relationship sections render on every detail page.** "Items applying this status effect", "Recipes producing this potion", "Items in this category", etc., all from the single `entity_edges` table.
4. **Icon tints are visible.** Every item icon with a non-white `display_icon_color` renders tinted (Spider Venom potions green, Burning potions red, etc.).
5. **Legacy GUID routes 301 to the canonical slug route.** A smoke against a sample of 50 production item GUIDs returns 301 + correct `Location` header.
6. **Golden-file parity tests pass for the anchor patch.** For every status-effect, spell, enchantment, and item that composes a tooltip, the TS composer's output matches the captured in-game string byte-exactly when re-serialised to TMP markup.
7. **`auditEntityGraph` emits zero `relationshipMissingTarget` diagnostics.** No edge points at a non-public or missing target.
8. **`auditEntityGraph` emits zero `unresolvedEffectVariable` diagnostics.** Every (effect-kind, variable-name) pair from `effect-variable-bindings.json` resolves through a registered Zod schema.
9. **Production site smoke passes against the new release artifact.**
   - `/items`, `/items/<sample-slug>--<sample-id8>`, `/status-effects/<sample-slug>--<sample-id8>`, `/spells/<sample-slug>--<sample-id8>`, `/enchantments/<sample-slug>--<sample-id8>`, `/recipes/<sample-slug>--<sample-id8>`, `/tags/<sample-slug>--<sample-id8>`, `/stats/<sample-slug>--<sample-id8>`, `/categories/<sample-slug>--<sample-id8>` all return 200 with the expected entity name in HTML.
   - A sampled legacy GUID URL returns 301 with the correct `Location`.
   - `/data.sqlite` hash matches the artifact manifest.
10. **Roadmap closeout records:** snapshot id, Cloudflare deploy version, page count per entity type, total prerendered page count, composer parity diff against the captured goldens (must be empty), and `_routes.json` rule count (must be ≤ 100).

---

## 11. Out of scope (deferred)

- Monsters, vendors, locations, factions, weather — Slice 5+.
- Full-text search and Pagefind facets — Slice 10.
- Override mechanism — deferred.
- ColorAsset, AnimationCurve, FlowGraph, AI behaviour assets, particle prefabs, mesh prefabs — captured only as private references (no public page) until a slice needs them.
- Storybook / visual regression — deferred (dev gallery only).
- i18n — out of scope; we ship English text from the game as-is.

---

## 12. Verification commands

Local gates the slice must pass before deploy:

```sh
bun run codegen:validators
bun run check:fixtures
dotnet test mod-tests/ArdenfallCompendium.Tests.csproj
bun test pipeline/test
bun test tooling.test.ts
bun test controller/test
bun run typecheck
bun run --cwd site check
bun run artifact:fixture synthetic fixtures/synthetic/snapshot
NODE_OPTIONS=--max-old-space-size=8192 bun run --cwd site build:fixture
bun run --cwd site smoke:prerender
bun run --cwd site smoke:item-icons
bun run --cwd site smoke:legacy-item-redirects   # new
bun run --cwd site smoke:entity-pages             # new — overview + sample detail for every new entity
bun run format:check
bun run lint
git diff --check
```

Plus the composer golden-file suite:

```sh
bun test pipeline/test/composer/**/*.golden.test.ts
```

Live release closeout adds (after deploy):

```sh
bun run --cwd site smoke:production-release ./pipeline/artifacts/releases/<artifact-id>/artifact-manifest.json
```
