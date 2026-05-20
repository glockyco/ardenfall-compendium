[← Previous phase](10-status-effect.md) · [Next phase →](12-enchantment.md) · [Coordinator](../2026-05-20-items-presentation-closure.md)

# Phase 11: `spell` entity + composer port

**Spec coverage:** §3.2, §4.3, §7.4.

**Why eleventh:** every slate-spell item composes its tooltip body through `SpellData.GetTooltip` (`.decompiled/.../SpellData.cs:181-244`), which uses `SpellTooltip.GetTooltip` over both top-level `spells: SpellEffect[]` and per-sub-spell `subSpells[i].effects[k]`, with optional primary/secondary level switching and inheritance via `spellEffectReference`. Slate-spell items are 281 of the 1,273 items in the live snapshot; without spell extraction every one of them shows no effect text. Phase 11 instantiates the composer-entity template for spells.

**Outcome:** every `SpellData` asset is exported with `spellName`, `iconRef`, `statTypeRef`, `manaCost`, full `SpellEffect[]` payloads via the Phase 7 serializer, `subSpells[]` with their own effect arrays, `tooltipTemplate` + variables (including subspell + secondary-level discriminators), `spellEffectReference` ref, color refs; the pipeline canonicalises into `spells` + `effect_instances` (with `owner_scope='spell-spells'` and `spell-subspell-<i>-effects`); the composer port `pipeline/src/composer/spell-tooltip.ts` produces composed text matching captured in-game strings; `/spells` + `/spells/[slug]` pages render the composed text + structured atoms.

## Template instantiation

Phase 11 instantiates the **composer-entity template** from [10-status-effect.md](10-status-effect.md):

| Template parameter          | Phase 11 value                                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------- |
| Entity id                   | `spell`                                                                                             |
| Plural id                   | `spells`                                                                                            |
| Asset C# type               | `Ardenfall.SpellData`                                                                               |
| Mod namespace               | `ArdenfallCompendium.Entities.Spell`                                                                |
| Composer module             | `pipeline/src/composer/spell-tooltip.ts`                                                            |
| Canonical table             | `spells`                                                                                            |
| Effect instance owner_type  | `spell`                                                                                             |
| Effect instance owner_scope | `spell-spells` for top-level effects; `spell-subspell-<i>-effects` for the `i`th subspell's effects |
| Render context              | `spell-presentation-v1`                                                                             |
| Site overview route         | `/spells`                                                                                           |
| Site detail route           | `/spells/[slug]`                                                                                    |
| Slug source                 | `spellName`                                                                                         |
| Composer port file          | `pipeline/src/composer/spell-tooltip.ts`                                                            |
| Golden file dir             | `fixtures/golden/0.0.10.91-anchor/spell/`                                                           |

## Phase-11-specific deviations from the composer-entity template

The spell composer has three details the status-effect composer does not:

1. **Variable resolution dispatches on `isSubspell` and `subspellEffectIndex`.** A spell variable with `isSubspell: true, subspellEffectIndex: 2` resolves to `spell.subSpells[componentIndex].effects[2]` instead of `spell.effects[componentIndex]`.
2. **`usesSecondaryLevel`** flips the level input per variable. Carries through to `getValueFromField`'s `level` parameter (`secondaryLevel` instead of `level`).
3. **Composer output is wrapped** in `vocabulary.primarySpellTooltip` or `vocabulary.secondarySpellTooltip` prefix, and sub-tooltips are wrapped in `vocabulary.spellSubEffectColor`. The composer takes a `mode: "primary" | "secondary"` parameter that selects the prefix.

Plus inheritance:

4. **`spellEffectReference.spells`** is concatenated onto the local `spells` array when resolving variables (`SpellData.Spells` getter at `.decompiled/.../SpellData.cs:163-173`). The composer walks the inheritance chain to compose the full effect list before variable resolution.

## Phase 11 task list (eight slots)

The structure mirrors Phase 10. For each task, follow the corresponding Phase 10 task with these deltas:

### Task 11.1: Mod DTO — `SpellSnapshot`

Apply Task 10.1 with these fields:

```cs
public sealed record SpellSnapshot(
    string Id,
    string SpellName,
    object? IconRef,
    object? StatTypeRef,
    float ManaCost,
    bool IsIllegal,                                  // game spelling preserved: isIlligal
    AppliedColorSerializedSnapshot Color,
    object? UseStatusEffectColorRef,
    AppliedColorSerializedSnapshot? SimpleColor,
    SpellTooltipSnapshot Tooltip,
    List<EffectInstanceSnapshot> Spells,
    List<SubSpellSnapshot> SubSpells,
    object? SpellEffectReferenceRef,
    LeveledFloatSnapshot QuickUseCooldown,
    LeveledFloatSnapshot CastCooldown,
    LeveledFloatSnapshot CastHardCooldown,
    float AiCooldownMultiplier,
    string AiSpellType);

public sealed record SpellTooltipSnapshot(
    string Template,
    List<SpellTooltipVariableSnapshot> Variables);

public sealed record SpellTooltipVariableSnapshot(
    int ComponentIndex,
    string VariableName,
    string Type,
    bool IsPercentage,
    bool OneMinus,
    bool Invert,
    bool AbsoluteValue,
    bool IsInt,
    bool RountToTenths,
    float Multiplier,
    float Add,
    bool IsSubspell,
    int SubspellEffectIndex,
    bool UsesSecondaryLevel,
    bool IsTargetSelf);

public sealed record SubSpellSnapshot(
    string Name,
    List<EffectInstanceSnapshot> Effects);
```

Tests + commits follow Task 10.1's pattern. Commit: `feat(mod): spell snapshot DTOs`.

### Task 11.2: Mod extractor — `SpellExtractor`

Apply Task 10.2 with these specifics:

- Walks `BuiltLookupTable.GetAssetsOfType<SpellData>()`.
- For each asset, runs `EffectSerializer.Serialize` on every entry of `asset.spells` (using `owner_scope = "spell-spells"`) and every entry of `asset.subSpells[i].effects` (using `owner_scope = "spell-subspell-<i>-effects"`).
- Populates the audit pass via a new `ISpellAuditSource` adapter that walks `asset.tooltip.variables` and reports `(componentIndex, variableName, isSubspell, subspellEffectIndex, usesSecondaryLevel)`.
- Resolves `asset.spellEffectReference` via the ref resolver.

Tests cover: extraction of a spell with one top-level effect; extraction with one subspell + one effect; extraction with `spellEffectReference` resolving correctly.

Commit: `feat(mod): extract spell snapshots`.

### Task 11.3: Walker registration + golden capture extension

Add `SpellExtractor` to the mod's extraction orchestrator with `entityId = "spells"`.

Extend `StatusEffectGoldenCaptureCommand` (or a parallel `SpellGoldenCaptureCommand`) to capture `SpellData.GetTooltip(SpellInputMode.Primary, MinLevel, SecondaryLevel)` per spell. `SecondaryLevel` defaults to MinLevel when `enableSecondaryLevel` is false on the asset's leveled spell data.

Commit: `feat(mod): capture spell golden tooltips`.

### Task 11.4: Pipeline descriptor + envelope + DDL

`entities/spell/entity.json` follows the small-entity descriptor shape (Task 4.4) with `routePath: "/spells"`, `canonicalTable: "spells"`, `presentationContext.renderContext: "spell-presentation-v1"`.

```ts
// pipeline/src/sql/spell-ddl.ts
export const SPELL_DDL = `
CREATE TABLE spells (
  id                            TEXT PRIMARY KEY,
  spell_name                    TEXT NOT NULL,
  icon_hash                     TEXT,
  stat_type_id                  TEXT,
  mana_cost                     REAL NOT NULL,
  is_illegal                    INTEGER NOT NULL DEFAULT 0,
  color_json                    TEXT NOT NULL,
  use_status_effect_color_id    TEXT,
  simple_color_json             TEXT,
  tooltip_template              TEXT NOT NULL,
  tooltip_variables_json        TEXT NOT NULL,
  sub_spells_json               TEXT NOT NULL DEFAULT '[]',
  spell_effect_reference_id     TEXT,
  cooldowns_json                TEXT NOT NULL,
  ai_cooldown_multiplier        REAL NOT NULL DEFAULT 1,
  ai_spell_type                 TEXT
);
`;
```

Wire into `emit-sqlite.ts` after the status-effect canonicaliser.

Commit: `feat(pipeline): add spell descriptor and DDL`.

### Task 11.5: Pipeline canonicaliser + audit validation

Apply Task 10.5 with two extensions:

1. Effect instances are inserted with the correct `owner_scope` (`spell-spells` for `asset.spells[i]`; `spell-subspell-${i}-effects` for `asset.subSpells[i].effects[j]`).
2. The audit walks each spell's tooltip variables and confirms each `(effectKind, variableName)` resolves through the Zod registry. New kinds discovered in spell data (`AOESpellEffect`, `ProjectileSpellEffect`, `StatusEffectTooltipSpellEffect`, `RaiseDeadSpellEffect`, etc.) get their Zod schema added under `pipeline/src/composer/effect-kinds/<Kind>.zod.ts`.

Commit: `feat(pipeline): canonicalise spell snapshots`.

### Task 11.6: Composer port — `spell-tooltip.ts`

**Files:**

- Create: `pipeline/src/composer/spell-tooltip.ts`
- Test: `pipeline/test/composer/spell-tooltip.test.ts`

```ts
// pipeline/src/composer/spell-tooltip.ts
import type { MasterTooltipVocabulary } from "../types.ts";
import type { VariableBinding } from "./composer-context.ts";
import { applyColors, getValueFromField } from "./string-tooltip.ts";
import { applyColorCodes } from "./master-data.ts";

export type SpellInputMode = "primary" | "secondary";

export interface SpellSnapshot {
  id: string;
  spellName: string;
  manaCost: number;
  tooltip: { template: string; variables: SpellVariableBinding[] };
  spells: { kind: string; payload: Record<string, unknown> }[];
  subSpells: { name: string; effects: { kind: string; payload: Record<string, unknown> }[] }[];
  spellEffectReference?: SpellSnapshot;
}

export interface SpellVariableBinding extends VariableBinding {
  isSubspell: boolean;
  subspellEffectIndex: number;
  usesSecondaryLevel: boolean;
  isTargetSelf: boolean;
}

export interface ComposeSpellInput {
  spell: SpellSnapshot;
  mode: SpellInputMode;
  level: number;
  secondaryLevel: number;
  vocabulary: MasterTooltipVocabulary;
  recurseStatusEffect?: (
    statusEffectRef: unknown,
    level: number,
    lifetime: number,
    targetSelf: boolean,
  ) => string;
}

export function composeSpellTooltip(input: ComposeSpellInput): string {
  const { spell, vocabulary, mode } = input;
  const inheritedSpells = collectInheritedSpells(spell);
  let text = spell.tooltip.template;
  spell.tooltip.variables.forEach((variable, i) => {
    const effect = variable.isSubspell
      ? spell.subSpells[variable.componentIndex]?.effects[variable.subspellEffectIndex]
      : inheritedSpells[variable.componentIndex];
    const useLevel = variable.usesSecondaryLevel ? input.secondaryLevel : input.level;
    const value = effect
      ? getValueFromField({
          payload: effect.payload,
          variable,
          level: useLevel,
          lifetime: 0,
          targetSelf: variable.isTargetSelf,
          vocabulary,
          recurseStatusEffect: input.recurseStatusEffect,
        })
      : "";
    text = text.replace(`{${i}}`, value);
  });
  // Sub-tooltip wrap: each spell effect can emit a sub-tooltip via the composer's recurse hook;
  // wrap the concatenated sub-tooltip block in `<color=spellSubEffectColor>...</color>`.
  // The actual sub-tooltip extraction depends on the SpellEffect kinds; for the initial set we
  // support `StatusEffectTooltipSpellEffect.statusEffects[]` recursion via recurseStatusEffect.
  text = applyColors(text, vocabulary);
  text = applyColorCodes(text, vocabulary);
  const prefix =
    mode === "primary" ? vocabulary.primarySpellTooltip : vocabulary.secondarySpellTooltip;
  return prefix ? prefix.replace("{0}", spell.spellName).replace("{1}", text) : text;
}

function collectInheritedSpells(
  spell: SpellSnapshot,
): { kind: string; payload: Record<string, unknown> }[] {
  const result = [...spell.spells];
  if (spell.spellEffectReference) {
    result.push(...collectInheritedSpells(spell.spellEffectReference));
  }
  return result;
}
```

Tests cover: primary mode renders the prefix; secondary mode uses the secondary prefix; subspell variables dispatch correctly; usesSecondaryLevel flips the level input; spellEffectReference inheritance concatenates spells.

Commit: `feat(pipeline): compose spell tooltip`.

### Task 11.7: Read-model + composed-text persistence + golden-file tests

Apply Task 10.7 with `spell_overview_rows` + `spell_presentation_rows`:

```sql
CREATE TABLE spell_overview_rows (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  icon_hash           TEXT,
  stat_type_id        TEXT,
  mana_cost           REAL NOT NULL,
  is_illegal          INTEGER NOT NULL DEFAULT 0,
  display_color       TEXT
);
CREATE TABLE spell_presentation_rows (
  id                                TEXT PRIMARY KEY,
  name                              TEXT NOT NULL,
  render_context                    TEXT NOT NULL,
  icon_hash                         TEXT,
  stat_type_id                      TEXT,
  mana_cost                         REAL NOT NULL,
  description_primary_rich_text_json TEXT NOT NULL,
  description_secondary_rich_text_json TEXT,
  sub_spells_json                   TEXT NOT NULL DEFAULT '[]',
  level_table_json                  TEXT NOT NULL,
  flags_json                        TEXT NOT NULL,
  diagnostics_json                  TEXT NOT NULL DEFAULT '[]'
);
```

The level table renders the composer output at five representative levels per spell, in both primary and secondary mode where applicable.

Golden tests under `pipeline/test/composer/spell-golden.test.ts` iterate `fixtures/golden/0.0.10.91-anchor/spell/*.json` and verify byte-exact match.

Commit: `feat(pipeline): spell read model with composed text`.

### Task 11.8: Site overview + detail pages

Apply Task 10.8's site-page pattern with spell-specific bits:

- The detail page shows two rich-text blocks (primary + secondary tooltip) when both exist.
- The mana cost row is a top-level field; the cooldowns are shown in a small fact block ("Quick use cooldown", "Cast cooldown", "Heavy cast cooldown") computed at `level = 1`.
- A "Sub-spells" section enumerates `subSpells[]` with their composed sub-tooltips.
- A "Stat type" link points at `/stats/<slug>` (resolved via the canonical slug for the spell's statType ref).

Components: `SpellOverview.svelte`, `SpellDetail.svelte`, `SpellLevelTable.svelte`, `SpellSubSpellList.svelte`, `SpellCooldowns.svelte`.

Commit: `feat(site): render spell pages`.

### Task 11.9: Phase 11 verification gate

- [ ] Run the standard phase gate.
- [ ] Confirm every fixture spell golden passes.
- [ ] Visit `/spells` and a representative slate-spell page; confirm composed text matches expectations.
- [ ] Update coordinator phase index row 11 status to ✅.

---

[← Previous phase](10-status-effect.md) · [Next phase →](12-enchantment.md) · [Coordinator](../2026-05-20-items-presentation-closure.md)
