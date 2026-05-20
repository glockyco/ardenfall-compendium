[← Previous phase](11-spell.md) · [Next phase →](13-potion-recipe.md) · [Coordinator](../2026-05-20-items-presentation-closure.md)

# Phase 12: `enchantment` entity + composer port

**Spec coverage:** §3.2, §4.3, §7.5.

**Why twelfth:** every weapon / armor enchantment line in the in-game tooltip flows through `EnchantmentData.GetTooltip(level, item)` (`.decompiled/.../Item/EnchantmentData.cs:54-79`) → `EnchantmentTooltip.GetTooltip` (`EnchantmentTooltip.cs:30-62`). The composer carries two extra mechanisms vs. status-effect / spell composers:

1. **`targetVars` wholesale template replacement.** For a given variable, if the `targetVars` list contains an entry whose `itemRef` matches the rendering item, the _entire template_ is replaced with `targetVar.text` — reflective substitution is skipped.
2. **Suppression flags.** `EnchantmentData.hideEffectTooltips` suppresses the entire sub-tooltip block. `StatusEffectEnchantmentEffect.hideEnchantmentTooltip` suppresses individual lines.

Phase 12 instantiates the composer-entity template with these two extensions, then extracts every `EnchantmentData` so weapon/armor pages can render their enchantment lines in Phase 14.

**Outcome:** every `EnchantmentData` asset is exported with full `EnchantmentEffect[]` payloads, tooltip template + variables (including `targetVars` per variable), filter lists (`baseItemDataFilterBlacklist`/`Whitelist`), display flags, color; the pipeline canonicalises into `enchantments` + `effect_instances`; the composer port `pipeline/src/composer/enchantment-tooltip.ts` produces composed text honouring item-target overrides + suppression; `/enchantments` + `/enchantments/[slug]` render.

## Template instantiation

Phase 12 instantiates the **composer-entity template** from [10-status-effect.md](10-status-effect.md):

| Template parameter          | Phase 12 value                                  |
| --------------------------- | ----------------------------------------------- |
| Entity id                   | `enchantment`                                   |
| Plural id                   | `enchantments`                                  |
| Asset C# type               | `Ardenfall.Item.EnchantmentData`                |
| Mod namespace               | `ArdenfallCompendium.Entities.Enchantment`      |
| Composer module             | `pipeline/src/composer/enchantment-tooltip.ts`  |
| Canonical table             | `enchantments`                                  |
| Effect instance owner_type  | `enchantment`                                   |
| Effect instance owner_scope | `enchantment-effects`                           |
| Render context              | `enchantment-presentation-v1`                   |
| Site overview route         | `/enchantments`                                 |
| Site detail route           | `/enchantments/[slug]`                          |
| Slug source                 | `enchantmentName`                               |
| Golden file dir             | `fixtures/golden/0.0.10.91-anchor/enchantment/` |

## Phase-12-specific deviations from the composer-entity template

1. **Tooltip variables carry a `targetVars: [{itemRef, text}]` list** (mod-side DTO + pipeline schema + composer port).
2. **Composer signature accepts `itemRef?: SnapshotRef`** — the item the enchantment is being rendered against. The composer matches `itemRef` against each variable's `targetVars` list before falling back to reflective substitution.
3. **`hideEffectTooltips` on the asset** short-circuits the composer's sub-tooltip emission step.
4. **`StatusEffectEnchantmentEffect.hideEnchantmentTooltip`** is honoured per-effect in the sub-tooltip pass.
5. **Cross-link**: `TimedEnchantmentEffect.enchantmentToApply` and `EnchantmentLevelEffect.enchantmentFilter` produce recursive `enchantment.cascades_to_enchantment` edges (emitted in Phase 15 graph rebuild).

## Phase 12 task list

### Task 12.1: Mod DTOs

Apply Task 10.1 / 11.1 with:

```cs
public sealed record EnchantmentSnapshot(
    string Id,
    string EnchantmentName,
    object? IconRef,
    AssetColorSnapshot EnchantmentIconColor,
    float MoneyValue,
    bool HideEffectTooltips,
    bool ShowEnchantmentColor,
    bool EnableEnchantmentMesh,
    bool EnableCustomEnchantmentColor,
    AssetColorSnapshot CustomEnchantmentColor,
    int CustomEnchantmentColorImportance,
    List<object?> BaseItemDataFilterBlacklistRefs,
    List<object?> BaseItemDataFilterWhitelistRefs,
    EnchantmentTooltipSnapshot Tooltip,
    List<EffectInstanceSnapshot> Effects);

public sealed record EnchantmentTooltipSnapshot(
    string Template,
    List<EnchantmentTooltipVariableSnapshot> Variables);

public sealed record EnchantmentTooltipVariableSnapshot(
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
    bool IsTargetSelf,
    List<EnchantmentTargetVarSnapshot> TargetVars);

public sealed record EnchantmentTargetVarSnapshot(
    object? ItemRef,
    string Text);
```

Tests + commit: `feat(mod): enchantment snapshot DTOs`.

### Task 12.2: Mod extractor

Apply Task 10.2 / 11.2 walking `BuiltLookupTable.GetAssetsOfType<EnchantmentData>()`. The extractor:

- Calls `EffectSerializer.Serialize` on every `asset.effects[i]` (owner_scope `enchantment-effects`).
- Resolves every `targetVars[k].itemRef` via the ref resolver.
- Resolves `baseItemDataFilterBlacklist` / `baseItemDataFilterWhitelist` ref arrays.
- Populates the audit pass via an `IEnchantmentAuditSource` adapter.

Commit: `feat(mod): extract enchantment snapshots`.

### Task 12.3: Walker registration + golden capture extension

Register the extractor (entityId `enchantments`). Extend the golden capture to walk `EnchantmentData.GetTooltip(level, item: null)` per enchantment (the base composition; per-item variants are exercised by item-rework goldens in Phase 14).

Commit: `feat(mod): capture enchantment golden tooltips`.

### Task 12.4: Pipeline descriptor + envelope + DDL

`entities/enchantment/entity.json` with `routePath: "/enchantments"`, `canonicalTable: "enchantments"`, `presentationContext.renderContext: "enchantment-presentation-v1"`.

```ts
// pipeline/src/sql/enchantment-ddl.ts
export const ENCHANTMENT_DDL = `
CREATE TABLE enchantments (
  id                                  TEXT PRIMARY KEY,
  enchantment_name                    TEXT NOT NULL,
  icon_hash                           TEXT,
  enchantment_icon_color_json         TEXT NOT NULL,
  money_value                         REAL NOT NULL DEFAULT 0,
  hide_effect_tooltips                INTEGER NOT NULL DEFAULT 0,
  show_enchantment_color              INTEGER NOT NULL DEFAULT 0,
  enable_enchantment_mesh             INTEGER NOT NULL DEFAULT 0,
  enable_custom_enchantment_color     INTEGER NOT NULL DEFAULT 0,
  custom_enchantment_color_json       TEXT NOT NULL,
  custom_enchantment_color_importance INTEGER NOT NULL DEFAULT 0,
  base_item_blacklist_json            TEXT NOT NULL DEFAULT '[]',
  base_item_whitelist_json            TEXT NOT NULL DEFAULT '[]',
  tooltip_template                    TEXT NOT NULL,
  tooltip_variables_json              TEXT NOT NULL
);
`;
```

Commit: `feat(pipeline): add enchantment descriptor and DDL`.

### Task 12.5: Pipeline canonicaliser + audit validation

Apply Task 10.5 / 11.5 with:

- `effect_instances.owner_scope = 'enchantment-effects'`.
- Audit-driven Zod validation, with new enchantment-specific kinds added under `pipeline/src/composer/effect-kinds/<Kind>.zod.ts` (e.g. `StatusEffectEnchantmentEffect`, `TriggerOnDamageEnchantmentEffect`, `TimedEnchantmentEffect`, `WeaponDamageModifyEnchantmentEffect`, `WeaponModificationEnchantmentEffect`, `KnockbackEnchantmentEffect`, `GreatswordAttackEnchantmentEffect`, `KatanaAttackEnchantmentEffect`, `ClothingParticlesEnchantmentEffect`, `SubTooltipEnchantmentEffect`).

Commit: `feat(pipeline): canonicalise enchantment snapshots`.

### Task 12.6: Composer port — `enchantment-tooltip.ts`

**Files:**

- Create: `pipeline/src/composer/enchantment-tooltip.ts`
- Test: `pipeline/test/composer/enchantment-tooltip.test.ts`

```ts
// pipeline/src/composer/enchantment-tooltip.ts
import type { MasterTooltipVocabulary } from "../types.ts";
import type { VariableBinding } from "./composer-context.ts";
import { applyColors, getValueFromField } from "./string-tooltip.ts";
import { applyColorCodes } from "./master-data.ts";

export interface EnchantmentVariableBinding extends VariableBinding {
  isTargetSelf: boolean;
  targetVars: { itemRef: { kind: "lookupAsset"; guid: string } | null; text: string }[];
}

export interface EnchantmentSnapshot {
  id: string;
  enchantmentName: string;
  hideEffectTooltips: boolean;
  tooltip: { template: string; variables: EnchantmentVariableBinding[] };
  effects: { kind: string; payload: Record<string, unknown> }[];
}

export interface ComposeEnchantmentInput {
  enchantment: EnchantmentSnapshot;
  level: number;
  itemRef?: { kind: "lookupAsset"; guid: string } | null;
  vocabulary: MasterTooltipVocabulary;
  recurseStatusEffect?: (
    statusEffectRef: unknown,
    level: number,
    lifetime: number,
    targetSelf: boolean,
  ) => string;
}

export function composeEnchantmentTooltip(input: ComposeEnchantmentInput): string {
  const { enchantment, vocabulary, itemRef } = input;
  let text = enchantment.tooltip.template;
  enchantment.tooltip.variables.forEach((variable, i) => {
    const targetOverride = matchTargetOverride(variable, itemRef);
    if (targetOverride !== null) {
      text = text.replace(`{${i}}`, targetOverride);
      return;
    }
    const effect = enchantment.effects[variable.componentIndex];
    const value = effect
      ? getValueFromField({
          payload: effect.payload,
          variable,
          level: input.level,
          lifetime: 0,
          targetSelf: variable.isTargetSelf,
          vocabulary,
          recurseStatusEffect: input.recurseStatusEffect,
        })
      : "";
    text = text.replace(`{${i}}`, value);
  });
  text = text.replaceAll("{level}", input.level.toString());
  text = applyColors(text, vocabulary);
  text = applyColorCodes(text, vocabulary);
  return text;
}

function matchTargetOverride(
  variable: EnchantmentVariableBinding,
  itemRef: ComposeEnchantmentInput["itemRef"],
): string | null {
  if (!variable.targetVars || variable.targetVars.length === 0) return null;
  if (!itemRef || itemRef.kind !== "lookupAsset") return null;
  for (const candidate of variable.targetVars) {
    if (candidate.itemRef?.kind === "lookupAsset" && candidate.itemRef.guid === itemRef.guid) {
      return candidate.text;
    }
  }
  // The game's behaviour is: when targetVars are declared but no match, the variable still falls back to reflection.
  // Verified at `.decompiled/.../EnchantmentTooltip.cs:43-58` — the wholesale replacement only fires on match.
  return null;
}
```

Tests cover:

- `targetVars` empty → reflective substitution applies.
- `targetVars` matches the rendering item → wholesale replacement; reflection skipped.
- `targetVars` declared but no match → reflective substitution applies (fallback documented at the game-source line above).
- `hideEffectTooltips` flag: in the caller (read-model emitter), the entire sub-tooltip block is skipped — the composer itself does not need to suppress; that's the read-model's job. Document this in the composer's doc comment.

Commit: `feat(pipeline): compose enchantment tooltip`.

### Task 12.7: Read-model + composed-text + golden tests

Apply Task 10.7 / 11.7 with `enchantment_overview_rows` + `enchantment_presentation_rows`:

```sql
CREATE TABLE enchantment_overview_rows (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  icon_hash       TEXT,
  icon_color_json TEXT,
  money_value     REAL NOT NULL DEFAULT 0
);
CREATE TABLE enchantment_presentation_rows (
  id                          TEXT PRIMARY KEY,
  name                        TEXT NOT NULL,
  render_context              TEXT NOT NULL,
  icon_hash                   TEXT,
  icon_color_json             TEXT,
  money_value                 REAL NOT NULL DEFAULT 0,
  description_rich_text_json  TEXT NOT NULL,        -- composed with itemRef = null (the generic line)
  per_item_overrides_json     TEXT NOT NULL,        -- precomputed composed text for every item in baseItemWhitelist
  level_table_json            TEXT NOT NULL,
  flags_json                  TEXT NOT NULL,
  diagnostics_json            TEXT NOT NULL DEFAULT '[]'
);
```

`per_item_overrides_json` is the composer's output run once per item-target the enchantment can apply to (read from `baseItemDataFilterWhitelist` ∪ items that reference the enchantment in Phase 14). This is the data the item page in Phase 14 reads to render the enchantment line with the correct target-specific text.

Golden tests load every fixture enchantment + run `composeEnchantmentTooltip` with `itemRef: null` AND with each `baseItemDataFilterWhitelist` entry, comparing against the captured strings.

Commit: `feat(pipeline): enchantment read model with composed text`.

### Task 12.8: Site overview + detail pages

Apply Task 10.8 / 11.8 with enchantment-specific bits:

- The detail page renders the generic composed text + an expandable "Per-item variations" section that lists every item-target with its composed override.
- A "Cascades into" section appears for `TimedEnchantmentEffect` / `EnchantmentLevelEffect` references.
- Reverse relationship sections (items that grant this enchantment) come in Phase 15.

Components: `EnchantmentOverview.svelte`, `EnchantmentDetail.svelte`, `EnchantmentPerItemVariations.svelte`, `EnchantmentLevelTable.svelte`.

Commit: `feat(site): render enchantment pages`.

### Task 12.9: Phase 12 verification gate

- [ ] Run the standard phase gate.
- [ ] Confirm every fixture enchantment golden passes.
- [ ] Visit `/enchantments` and a representative enchantment page; confirm composed text matches captured.
- [ ] Update coordinator phase index row 12 status to ✅.

---

[← Previous phase](11-spell.md) · [Next phase →](13-potion-recipe.md) · [Coordinator](../2026-05-20-items-presentation-closure.md)
