[← Previous phase](13-potion-recipe.md) · [Next phase →](15-graph-rebuild.md) · [Coordinator](../2026-05-20-items-presentation-closure.md)

# Phase 14: Item re-extraction + presentation re-composer

**Spec coverage:** §3.1, §6.5.

**Why fourteenth:** every preceding phase fed items the substrate they need (composer ports, slug routing, status-effect / spell / enchantment / category / tag / stat-type / recipe entities). Phase 14 closes the loop: items are re-extracted with the missing per-variant fields (`hardAttackDamMult`, `enchantments[]`, full `statTypeRef`), then a new pipeline composer assembles the item presentation row by reading through the new entities — pulling status-effect lines via the Phase 10 composer, enchantment lines via Phase 12, spell lines via Phase 11 — and persisting them into `item_presentation_rows`. The site item detail page reads the new fields verbatim; no item-side composer logic remains site-side.

**Outcome:** every item in the live snapshot ships with full per-variant atoms; `item_presentation_rows` carries pre-computed stat rows with the game's exact labels ("Damage Threshold", "Heavy Attack Damage", "Mana Usage"), composed effect text from real status-effect / spell / enchantment data, real tag-row body text, and a non-placeholder item-type label; the in-game item details panel is reproduced deterministically on every public item page; "Canonical compendium state" disappears; "Status effects status-effect" disappears.

## Architecture

Two distinct sub-streams in this phase:

1. **Mod-side re-extraction** — fix the gaps identified in spec §3.1: equipment `enchantments[]` + `builtInEnchantments[]`, melee `hardAttackDamMult` + remaining numeric fields, `EquipItemData.statType` as a resolved `SnapshotRef` instead of `Object.ToString()`. Bump `items.json.schemaVersion` from 2 → 3.

2. **Pipeline-side item presentation composer** — a new orchestrator in `pipeline/src/composer/item-presentation.ts` that, given an item canonical row + the new entity tables, produces a populated `item_presentation_rows` row with:
   - `item_type` derived by per-variant rule (see spec §6.5).
   - `stat_rows_json` computed per variant (Damage, Heavy Attack Damage, Damage Threshold, Mana Usage).
   - `requirements_json` from `EquipItemData.statType` + `minimumSkill`.
   - `durability_json` from per-variant durability.
   - `effects_source_rich_text_json` composed from status-effect / spell / enchantment / tag substrate.
   - `effect_facts_json` structured chips ("On Drink:", "On Hit:", "Tag: Incredibly valuable remedy").
   - `state_facts_json` with the "Canonical compendium state" pseudo-fact removed.

## Tasks

### Task 14.1: Mod re-extraction — melee, armor, equipment catch-up

**Files:**

- Modify: `mod/src/Entities/Item/Adapters/ExtractMelee.cs` (add `hardAttackDamMult`, `stunChance`, `bleedChance`, `pierceChance`, `stealthStunChance`, `critDamageMult`, `knockbackStrength`, `knockbackStrengthHard`, `stealthHitMultiplier`, `bleedMultiplier`, `hitStopTime`, `attributeType` ref, `bleedStatusEffect` snapshot, `hardAttackStaminaMultiplier`, `quickAttackStaminaMultiplier`, `blockStaminaMultiplier`, `parryStaminaMultiplier`, `canParry`, `canBeParried`)
- Modify: `mod/src/Entities/Item/Adapters/ExtractEquipment.cs` (capture `enchantments` + `builtInEnchantments` as a list of `{ enchantmentRef, level, hidden }`; capture `statType` as a real ref via `Refs.ResolveAsset`)
- Modify: `mod/src/Entities/Item/ItemSnapshot.cs` (bump `ItemSnapshotEnvelope.SchemaVersion` from 2 → 3)
- Test: extend `mod-tests/Item*Tests.cs` to cover the new fields

- [ ] **Step 1: Write the failing tests**

```cs
// mod-tests/ExtractMeleeTests.cs (extend existing)
[Fact]
public void CapturesHardAttackDamMult()
{
    var asset = FakeMeleeItemData.WithFields(damage: 50f, hardAttackDamMult: 2.5f);
    var result = ExtractMelee.Extract(asset, refs: new RefResolver(), rowId: "fixture");
    Assert.Equal(2.5f, result.Fields["hardAttackDamMult"]);
}

[Fact]
public void CapturesAttributeTypeRef()
{
    var asset = FakeMeleeItemData.WithAttributeType(statType: FakeStatType.Strength);
    var result = ExtractMelee.Extract(asset, refs: new RefResolver(), rowId: "fixture");
    Assert.NotNull(result.Fields["attributeTypeRef"]);
}

// mod-tests/ExtractEquipmentTests.cs
[Fact]
public void CapturesEnchantmentsArray()
{
    var asset = FakeEquipItemData.WithEnchantments(new[]
    {
        new FakeLeveledEnchantment("fixture-burning-1", level: 1, hidden: false),
        new FakeLeveledEnchantment("fixture-haste-2",   level: 2, hidden: true),
    });
    var result = ExtractEquipment.Extract(asset, refs: new RefResolver(), rowId: "fixture");
    var enchantments = result.Fields["enchantments"] as System.Collections.IList;
    Assert.Equal(2, enchantments?.Count);
}

[Fact]
public void CapturesStatTypeAsRef()
{
    var asset = FakeEquipItemData.WithStatType(FakeStatType.HeavyArmor);
    var result = ExtractEquipment.Extract(asset, refs: new RefResolver(), rowId: "fixture");
    Assert.IsAssignableFrom<object>(result.Fields["statTypeRef"]);   // ref shape, not a string
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj`
Expected: FAIL — fields not yet wired.

- [ ] **Step 3: Implement**

In `ExtractMelee.cs`, add each missing field to the returned `Fields` dictionary + `Provenance`. In `ExtractEquipment.cs`, replace the existing `statType.ToString()` shim with `Refs.ResolveAsset(asset.statType.Get(), "statTypeRef", rowId, MissingPolicy.Fatal, "EquipItemData.statType")` and add the `enchantments` / `builtInEnchantments` arrays via:

```cs
var enchantments = asset.enchantments?
    .Select(le => new
    {
        enchantmentRef = Refs.ResolveAsset(le.enchantment, "enchantmentRef", rowId, MissingPolicy.Diagnostic, "EquipItemData.enchantments.enchantment"),
        level = le.level,
        hidden = le.hidden,
    })
    .ToList<object>() ?? new List<object>();
fields["enchantments"] = enchantments;

var builtInEnchantments = asset.builtInEnchantments?.Get()?
    .Select(le => new
    {
        enchantmentRef = Refs.ResolveAsset(le.enchantment, "enchantmentRef", rowId, MissingPolicy.Diagnostic, "EquipItemData.builtInEnchantments.enchantment"),
        level = le.level,
        hidden = le.hidden,
    })
    .ToList<object>() ?? new List<object>();
fields["builtInEnchantments"] = builtInEnchantments;
```

Bump `ItemSnapshotEnvelope.SchemaVersion` from 2 → 3 in `ItemSnapshot.cs`.

- [ ] **Step 4: Run the tests + verify**

Run: `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj`
Expected: PASS.

- [ ] **Step 5: Commit**

```sh
git add mod/src/Entities/Item/Adapters/ExtractMelee.cs mod/src/Entities/Item/Adapters/ExtractEquipment.cs mod/src/Entities/Item/ItemSnapshot.cs mod-tests/ExtractMeleeTests.cs mod-tests/ExtractEquipmentTests.cs
git commit -m "feat(mod): backfill item per-variant gaps"
```

### Task 14.2: Pipeline schema bump + fixture update

**Files:**

- Modify: `schemas/snapshot.schema.json` (or `pipeline/src/stages/validate.ts`) to accept `items.json.schemaVersion = 3`
- Modify: `fixtures/synthetic/snapshot/items.json` (add the new fields to every fixture item; bump `schemaVersion` to 3)
- Refresh fixture hashes

- [ ] **Step 1: Update the schema**

Change the items envelope's `schemaVersion` constraint to `enum: [3]` (clean cutover — no v2 support).

- [ ] **Step 2: Update the fixture**

For each fixture item, populate the new fields (`hardAttackDamMult` on melee, `enchantments` on equipment, `statTypeRef` as a proper ref). Refresh both fixture-manifest hashes (snapshot + fixture pack).

- [ ] **Step 3: Run + commit**

Run: `bun run codegen:validators && bun run check:fixtures`

```sh
git add schemas/snapshot.schema.json pipeline/dist/validate-snapshot.mjs pipeline/dist/validate-snapshot.d.mts fixtures/synthetic/snapshot/items.json fixtures/synthetic/snapshot/manifest.json fixtures/synthetic/manifest.json
git commit -m "feat(pipeline): accept items envelope v3"
```

### Task 14.3: Item presentation composer

**Files:**

- Create: `pipeline/src/composer/item-presentation.ts`
- Test: `pipeline/test/composer/item-presentation.test.ts`

The orchestrator is a pure function:

```ts
export interface ComposeItemPresentationInput {
  itemId: string;
  variant: string;
  fields: Record<string, unknown>;
  vocabulary: MasterTooltipVocabulary;
  // Lookups into the canonical tables / read-models the pipeline already built:
  resolveStatusEffect: (statusEffectId: string) => StatusEffectSnapshot | undefined;
  resolveSpell: (spellId: string) => SpellSnapshot | undefined;
  resolveEnchantment: (enchantmentId: string) => EnchantmentSnapshot | undefined;
  resolveStatType: (statTypeId: string) => { name: string; routePath: string } | undefined;
  resolveTag: (
    tagId: string,
  ) => { name: string; description: string; routePath: string } | undefined;
  resolveCategory: (
    categoryId: string,
  ) => { name: string; defaultIconHash: string | null; categoryColor: ColorSnapshot } | undefined;
}

export interface ItemPresentationComposed {
  itemType: string | null;
  statRows: ItemStatRow[];
  requirements: ItemRequirement[];
  durability: ItemDurability | null;
  effectFacts: ItemEffectFact[];
  effectsSourceRichText: RichTextV1;
  stateFacts: ItemStateFact[];
  diagnostics: ComposerDiagnostic[];
}

export function composeItemPresentation(
  input: ComposeItemPresentationInput,
): ItemPresentationComposed;
```

Implementation reads:

- **itemType** per variant rule (spec §6.5):
  - `armor` → `resolveStatType(statTypeRefId).name`
  - `melee-weapon` → `resolveStatType(statTypeRefId).name`
  - `bow` / `throwing-item` → `fields.itemTypeTooltip`
  - `arrow` → `"Arrow"` constant
  - `slate-spell` → `resolveSpell(spellRefId).statTypeName + spellItemTypeSuffix(fields.spellItemType)`
  - others → `null`
- **statRows** per variant rule (spec §6.5):
  - `armor` → `[{id:"damage-threshold", label:"Damage Threshold", value: fields.armorRating, isLarge: true}]`
  - `melee-weapon` → `[{label:"Damage", value: fields.damage}, {label:"Heavy Attack Damage", value: fields.damage * fields.hardAttackDamMult}]`
  - `bow` / `arrow` / `throwing-item` → `[{label:"Damage", value: fields.damage}]`
  - `slate-spell` → `[{label:"Mana Usage", value: computeManaCost(fields.manaCostMultiplier, resolveSpell(spellRefId).manaCost, level: 1)}]`
  - others → `[]`
- **requirements** → `[{statTypeRef, statTypeName, minimum: fields.minimumSkill}]` for equipment with `fields.minimumSkill > 0`.
- **durability** → `{kind: "max-durability", max: fields.<durabilityField>, source: "<adapter field>"}` per variant.
- **effectFacts + effectsSourceRichText** — the big one. For each effect source:
  - Consumable `statusEffectsJson[]` → for each leveled status effect, compose via `composeStatusEffectTooltip` with `targetSelf=true`, level/lifetime from the entry, header `"On Consume:"`.
  - ThrowingPotion `areaOfEffectJson[]` → compose with `targetSelf = fields.isDrinkingPotion`, header `"On Drink:"` or `"On Hit:"`.
  - Equipment `enchantments[]` + `builtInEnchantments[]` → for each, compose via `composeEnchantmentTooltip` with `itemRef = thisItem`, header `"On Equip:"` or per-trigger header from the enchantment's `triggerEvent` (if `StatusEffectEnchantmentEffect`).
  - SlateSpell `spellDataJson` → compose via `composeSpellTooltip(mode: "primary")` + optional secondary.
  - MeleeItem `bleedStatusEffectJson` → compose with `targetSelf=false`, header `"On Hit:"`.
  - Tags → each tag's `description` becomes a `{kind: "tag", header: <tagName>, lines: [tagDescription]}` fact.
- **stateFacts** — drop the Slice-4 "Canonical compendium state" pseudo-fact entirely. Keep only real facts:
  - `{kind:"stackable", label:"Stackable", description:"Can be stacked in the inventory."}` if `fields.stackable`
  - `{kind:"quest-item", label:"Quest item"}` if `fields.questItem`
  - `{kind:"two-handed", label:"Two-handed"}` if `fields.twoHanded`
  - `{kind:"unique", label:"Unique"}` if `fields.cannotBeOwned` (the in-game "cannot be owned / stolen" semantics)

`effectsSourceRichText` is the concatenation of every `effectFacts[i].lines` joined into a single `rich_text_v1` document, with headers rendered as `<strong>` nodes.

- [ ] **Step 1: Write the failing tests** (one per variant rule above; one per effect source)

- [ ] **Step 2: Implement the composer**

- [ ] **Step 3: Run + commit**

```sh
git add pipeline/src/composer/item-presentation.ts pipeline/test/composer/item-presentation.test.ts
git commit -m "feat(pipeline): compose item presentation from canonical entities"
```

### Task 14.4: Wire the composer into `emit-read-models.ts`

**Files:**

- Modify: `pipeline/src/stages/emit-read-models.ts` (`emitItemReadModels` now calls `composeItemPresentation` per item and persists the resulting fields)

Replace the current `ItemPresentationBuilder`-driven population of `item_presentation_rows` with the new composer's output. The columns stay the same shape as Slice 4 plus the additions from spec §6.5 (`item_type`, expanded `stat_rows_json`, etc.).

The composer's `resolveStatusEffect` / `resolveSpell` / `resolveEnchantment` callbacks read from the canonical tables (`status_effects`, `spells`, `enchantments`) via small prepared statements. Caching: keep one `Map<string, T>` per resolve helper, populated lazily.

- [ ] **Step 1: Update existing read-models tests** to assert the new shape (e.g. `stat_rows_json` contains the "Heavy Attack Damage" row for melee items).

- [ ] **Step 2: Run + commit**

```sh
git add pipeline/src/stages/emit-read-models.ts pipeline/test/read-models.test.ts
git commit -m "feat(pipeline): item read-model uses presentation composer"
```

### Task 14.5: Site item detail + tooltip card update

**Files:**

- Modify: `site/src/lib/components/items/ItemPresentationPanel.svelte`
- Modify: `site/src/lib/components/items/ItemTooltipCard.svelte`
- Modify: `site/src/lib/components/items/ItemStateFacts.svelte` (drop "Canonical compendium state")
- Modify: `site/src/lib/components/items/ItemEffectList.svelte` (consume `effect_facts_json` chips + composed rich-text)

The site components now read the data verbatim — no composer logic site-side. The rich-text uses the existing `RichText` component from Slice 4.

Remove every fallback that interpreted the old "Status effects" / "Canonical compendium state" placeholders. Add a console-side validation in `getItemPresentation` that fails loudly if `effect_facts_json` is malformed (would indicate a pipeline bug).

- [ ] **Step 1: Remove the "Canonical compendium state" rendering**

In `ItemStateFacts.svelte`, drop any branch that emitted that fact; loop over the array and render every entry.

- [ ] **Step 2: Replace "Status effects status-effect" placeholder**

In `ItemEffectList.svelte`, render `effectFacts[]` chips (each `{header, lines: RichTextV1[]}` rendered as a `<dt>` + `<dd>` pair with the rich-text content).

- [ ] **Step 3: Tooltip card**

`ItemTooltipCard.svelte` reads the same data — the tooltip is a compact version of the detail page.

- [ ] **Step 4: Run + commit**

Run: `bun run --cwd site check && NODE_OPTIONS=--max-old-space-size=8192 bun run --cwd site build:fixture && bun run --cwd site smoke:prerender && bun run --cwd site smoke:item-icons`

```sh
git add site/src/lib/components/items/
git commit -m "feat(site): render composed item presentation"
```

### Task 14.6: Phase 14 verification gate

- [ ] Run the standard phase gate.
- [ ] Visit `/items/iron-sword--<id8>` (or any melee weapon) and confirm "Damage" + "Heavy Attack Damage" rows render.
- [ ] Visit `/items/<armor>` and confirm "Damage Threshold" label (not "Armor").
- [ ] Visit `/items/<consumable>` and confirm "On Consume: Restores 150 Health…" composed text matches the in-game tooltip.
- [ ] Visit `/items/<throwing-potion>` and confirm "On Drink:" / "On Hit:" header per `isDrinkingPotion`.
- [ ] Visit `/items/<enchanted-weapon>` and confirm enchantment lines render with target-specific text where applicable.
- [ ] Visit `/items/<slate-spell>` and confirm "Mana Usage" stat row + spell-effect lines.
- [ ] Visit `/items/<consumable>` and confirm tag-row descriptions render where present.
- [ ] No "Canonical compendium state" block anywhere.
- [ ] No "Status effects status-effect" placeholder anywhere.
- [ ] Icons tinted by category color (regression check from Phase 5).
- [ ] Update coordinator phase index row 14 status to ✅.

---

[← Previous phase](13-potion-recipe.md) · [Next phase →](15-graph-rebuild.md) · [Coordinator](../2026-05-20-items-presentation-closure.md)
