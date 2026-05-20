[← Previous phase](08-variable-binding-audit.md) · [Next phase →](10-status-effect.md) · [Coordinator](../2026-05-20-items-presentation-closure.md)

# Phase 9: Composer port — `string-tooltip` + `master-data` + golden harness

**Spec coverage:** §4.3, §7.1, §7.2, §7.6.

**Why ninth:** Phases 10–12 each port a specific composer (`StatusEffectTooltip`, `SpellTooltip`, `EnchantmentTooltip`) that all delegate to two lower-level passes — `StringTooltip.GetValueFromField` / `StringTooltip.ApplyColors` and `ArdenfallMasterData.ApplyColorCodes`. Phase 9 builds those two ports + the golden-file test infrastructure that will gate every later composer port. Without Phase 9, the composer ports in 10–12 have no test scaffolding.

**Outcome:** `pipeline/src/composer/` library with two pure-TypeScript ports of `StringTooltip` + `ArdenfallMasterData.ApplyColorCodes`, a per-effect-kind Zod schema registry (initial set covering the most-referenced effect kinds), and a golden-file test harness that ingests captured in-game strings and compares them against composer output byte-exactly. The status-effect / spell / enchantment composers in Phases 10–12 wire into this library.

## Architecture

`pipeline/src/composer/`:

- `string-tooltip.ts` — reflection grammar + transforms.
- `master-data.ts` — `ApplyColorCodes` term-set pass.
- `composer-context.ts` — input bundle (`MasterTooltipVocabulary`, ref resolver, level/lifetime/targetSelf).
- `effect-kinds/` — one `<Kind>.zod.ts` per registered effect kind.
- `effect-kinds/index.ts` — discriminated-union schema + lookup map `kind → schema`.
- `golden/` — golden-file harness.

## Tasks

### Task 9.1: `composer-context.ts` — shared input bundle

**Files:**

- Create: `pipeline/src/composer/composer-context.ts`

```ts
import type { MasterTooltipVocabulary, TermResolution } from "../types.ts";

export interface ComposerContext {
  vocabulary: MasterTooltipVocabulary;
  level: number;
  lifetime: number;
  targetSelf: boolean;
  resolveTerm?: (termId: string, label: string) => TermResolution | undefined;
}

export interface VariableBinding {
  componentIndex: number;
  variableName: string;
  type: "None" | "Percentage" | "PercentageAdd" | "PercentageMult";
  isPercentage: boolean;
  oneMinus: boolean;
  invert: boolean;
  absoluteValue: boolean;
  isInt: boolean;
  rountToTenths: boolean;
  multiplier: number;
  add: number;
  // Spell-specific fields (optional for status-effect and enchantment).
  isSubspell?: boolean;
  subspellEffectIndex?: number;
  usesSecondaryLevel?: boolean;
  isTargetSelf?: boolean;
}
```

`TermResolution` is the existing shape from `pipeline/src/rich-text/rich-text-v1.ts`. Re-export it here for convenience.

- [ ] Commit: `feat(pipeline): composer context types`.

### Task 9.2: `string-tooltip.ts` — port `GetValueFromField` + `ApplyColors`

**Files:**

- Create: `pipeline/src/composer/string-tooltip.ts`
- Test: `pipeline/test/composer/string-tooltip.test.ts`

The port mirrors `.decompiled/.../StringTooltip.cs:54-204` exactly. Reflection over typed payloads becomes property lookup on a JSON object with a controlled fallback chain.

- [ ] **Step 1: Write the failing tests**

```ts
// pipeline/test/composer/string-tooltip.test.ts
import { describe, expect, it } from "bun:test";
import { getValueFromField, applyColors } from "$pipeline/composer/string-tooltip";
import type { MasterTooltipVocabulary } from "$pipeline/types";

const vocab: MasterTooltipVocabulary = {
  schemaVersion: 2,
  tooltipCodes: { stamina: "Stamina" },
  tooltipColors: { p: { color: "#6FCF6F", text: "positive" } },
  tooltipTargetColor: { r: 1, g: 1, b: 1, a: 1 },
  tooltipDurationColor: { r: 1, g: 1, b: 1, a: 1 },
  positiveColor: { r: 0.43, g: 0.81, b: 0.43, a: 1 },
  negativeColor: { r: 0.95, g: 0.36, b: 0.36, a: 1 },
  spellSubEffectColor: { r: 0.8, g: 0.8, b: 0.8, a: 1 },
  enchantmentItemColor: { r: 0.55, g: 0.78, b: 0.85, a: 1 },
  primarySpellTooltip: "",
  secondarySpellTooltip: "",
  unmetSkillMessage: "",
  brokenDurabilityMessage: "",
  ruinedDurabilityMessage: "",
  statBookMessage: "",
  termSetColors: {},
  globalTermSets: [],
  termColorMatch: "",
  potionRecipeDescription: "",
};

describe("getValueFromField", () => {
  it("reads a plain float field", () => {
    const result = getValueFromField({
      payload: { modification: 5.5 },
      variable: {
        componentIndex: 0,
        variableName: "modification",
        type: "None",
        isPercentage: false,
        oneMinus: false,
        invert: false,
        absoluteValue: false,
        isInt: false,
        rountToTenths: true,
        multiplier: 1,
        add: 0,
      },
      level: 1,
      lifetime: 0,
      targetSelf: false,
      vocabulary: vocab,
    });
    expect(result).toBe("5.5");
  });

  it("applies the Percentage type (×100)", () => {
    const result = getValueFromField({
      payload: { chance: 0.25 },
      variable: {
        componentIndex: 0,
        variableName: "chance",
        type: "Percentage",
        isPercentage: false,
        oneMinus: false,
        invert: false,
        absoluteValue: false,
        isInt: false,
        rountToTenths: true,
        multiplier: 1,
        add: 0,
      },
      level: 1,
      lifetime: 0,
      targetSelf: false,
      vocabulary: vocab,
    });
    expect(result).toBe("25");
  });

  it("applies PercentageAdd ((1-x)×100)", () => {
    const result = getValueFromField({
      payload: { reduction: 0.3 },
      variable: {
        componentIndex: 0,
        variableName: "reduction",
        type: "PercentageAdd",
        isPercentage: false,
        oneMinus: false,
        invert: false,
        absoluteValue: false,
        isInt: false,
        rountToTenths: true,
        multiplier: 1,
        add: 0,
      },
      level: 1,
      lifetime: 0,
      targetSelf: false,
      vocabulary: vocab,
    });
    expect(result).toBe("70");
  });

  it("applies PercentageMult (x×100 - 100)", () => {
    const result = getValueFromField({
      payload: { gain: 1.4 },
      variable: {
        componentIndex: 0,
        variableName: "gain",
        type: "PercentageMult",
        isPercentage: false,
        oneMinus: false,
        invert: false,
        absoluteValue: false,
        isInt: false,
        rountToTenths: true,
        multiplier: 1,
        add: 0,
      },
      level: 1,
      lifetime: 0,
      targetSelf: false,
      vocabulary: vocab,
    });
    expect(result).toBe("40");
  });

  it("applies isPercentage suffix `%`", () => {
    const result = getValueFromField({
      payload: { gain: 0.25 },
      variable: {
        componentIndex: 0,
        variableName: "gain",
        type: "Percentage",
        isPercentage: true,
        oneMinus: false,
        invert: false,
        absoluteValue: false,
        isInt: false,
        rountToTenths: true,
        multiplier: 1,
        add: 0,
      },
      level: 1,
      lifetime: 0,
      targetSelf: false,
      vocabulary: vocab,
    });
    expect(result).toBe("25%");
  });

  it("expands LeveledFloat at the current level", () => {
    const result = getValueFromField({
      payload: { modification: { baseValue: 2, levelScale: 0.5 } },
      variable: {
        componentIndex: 0,
        variableName: "modification",
        type: "None",
        isPercentage: false,
        oneMinus: false,
        invert: false,
        absoluteValue: false,
        isInt: false,
        rountToTenths: true,
        multiplier: 1,
        add: 0,
      },
      level: 4,
      lifetime: 0,
      targetSelf: false,
      vocabulary: vocab,
    });
    expect(result).toBe("4"); // 2 + 0.5*4 = 4
  });

  it("rounds to tenths for floats", () => {
    const result = getValueFromField({
      payload: { mod: 3.14159 },
      variable: {
        componentIndex: 0,
        variableName: "mod",
        type: "None",
        isPercentage: false,
        oneMinus: false,
        invert: false,
        absoluteValue: false,
        isInt: false,
        rountToTenths: true,
        multiplier: 1,
        add: 0,
      },
      level: 1,
      lifetime: 0,
      targetSelf: false,
      vocabulary: vocab,
    });
    expect(result).toBe("3.1");
  });

  it("applies multiplier and add after rounding (matching game order)", () => {
    const result = getValueFromField({
      payload: { value: 1.5 },
      variable: {
        componentIndex: 0,
        variableName: "value",
        type: "None",
        isPercentage: false,
        oneMinus: false,
        invert: false,
        absoluteValue: false,
        isInt: false,
        rountToTenths: true,
        multiplier: 2,
        add: 5,
      },
      level: 1,
      lifetime: 0,
      targetSelf: false,
      vocabulary: vocab,
    });
    // 1.5 → rount to tenths → 1.5 → ×2 → 3 → +5 → 8
    expect(result).toBe("8");
  });

  it("absoluteValue applies at the end", () => {
    const result = getValueFromField({
      payload: { value: -3 },
      variable: {
        componentIndex: 0,
        variableName: "value",
        type: "None",
        isPercentage: false,
        oneMinus: false,
        invert: false,
        absoluteValue: true,
        isInt: false,
        rountToTenths: true,
        multiplier: 1,
        add: 0,
      },
      level: 1,
      lifetime: 0,
      targetSelf: false,
      vocabulary: vocab,
    });
    expect(result).toBe("3");
  });

  it("CharacterModFloat unwraps `.value`", () => {
    const result = getValueFromField({
      payload: { mod: { value: 12, isPercentage: false, isMultiplier: false } },
      variable: {
        componentIndex: 0,
        variableName: "mod",
        type: "None",
        isPercentage: false,
        oneMinus: false,
        invert: false,
        absoluteValue: false,
        isInt: false,
        rountToTenths: true,
        multiplier: 1,
        add: 0,
      },
      level: 1,
      lifetime: 0,
      targetSelf: false,
      vocabulary: vocab,
    });
    expect(result).toBe("12");
  });

  it("emits an empty string for unknown field", () => {
    const result = getValueFromField({
      payload: { somethingElse: 1 },
      variable: {
        componentIndex: 0,
        variableName: "missing",
        type: "None",
        isPercentage: false,
        oneMinus: false,
        invert: false,
        absoluteValue: false,
        isInt: false,
        rountToTenths: true,
        multiplier: 1,
        add: 0,
      },
      level: 1,
      lifetime: 0,
      targetSelf: false,
      vocabulary: vocab,
    });
    expect(result).toBe("");
  });
});

describe("applyColors", () => {
  it("expands `[p ...]` into a positive-color span", () => {
    expect(applyColors("[p +5] Stamina", vocab)).toContain("<color=#6FCF6F>positive</color>");
  });

  it("expands tooltipColors entries", () => {
    expect(applyColors("[p 5]", vocab)).toContain("<color=#6FCF6F>");
  });

  it("substitutes tooltipCodes", () => {
    expect(applyColors("Gain {stamina}", vocab)).toContain("Stamina");
  });
});
```

- [ ] **Step 2: Implement `getValueFromField`**

```ts
// pipeline/src/composer/string-tooltip.ts
import type { MasterTooltipVocabulary } from "../types.ts";
import type { VariableBinding } from "./composer-context.ts";

export interface GetValueFromFieldInput {
  payload: Record<string, unknown>;
  variable: VariableBinding;
  level: number;
  lifetime: number;
  targetSelf: boolean;
  vocabulary: MasterTooltipVocabulary;
  recurseStatusEffect?: (
    statusEffectRef: unknown,
    level: number,
    lifetime: number,
    targetSelf: boolean,
  ) => string;
}

export function getValueFromField(input: GetValueFromFieldInput): string {
  const { payload, variable, level, lifetime, targetSelf, recurseStatusEffect } = input;
  const raw = lookup(payload, variable.variableName, level);
  if (raw === undefined) return "";

  // Status effect recursion path: caller supplies the recursor (Phase 10 wires it).
  if (isStatusEffectLike(raw) && recurseStatusEffect) {
    if (Array.isArray(raw)) {
      // List-overwrite semantics from the game (last element wins).
      const last = raw[raw.length - 1] as {
        statusEffectRef?: unknown;
        level?: number;
        lifetime?: number;
      };
      return recurseStatusEffect(
        last?.statusEffectRef,
        last?.level ?? level,
        last?.lifetime ?? lifetime,
        targetSelf,
      );
    }
    const wrapper = raw as { statusEffectRef?: unknown; level?: number; lifetime?: number };
    return recurseStatusEffect(
      wrapper.statusEffectRef,
      wrapper.level ?? level,
      wrapper.lifetime ?? lifetime,
      targetSelf,
    );
  }

  let n = toNumber(raw, level);
  if (n === undefined) return "";

  switch (variable.type) {
    case "Percentage":
      n *= 100;
      break;
    case "PercentageAdd":
      n = (1 - n) * 100;
      break;
    case "PercentageMult":
      n = n * 100 - 100;
      break;
    case "None":
      break;
  }

  if (variable.oneMinus) n = 1 - n;
  if (variable.invert) n = -n;
  if (variable.isInt) n = Math.round(n);
  else if (variable.rountToTenths) n = Math.round(n * 10) / 10;
  n *= variable.multiplier;
  n += variable.add;
  if (variable.absoluteValue) n = Math.abs(n);

  // Integer formatting: drop trailing zero-decimal when the result is whole.
  const formatted = Number.isInteger(n) ? n.toString() : Number(n.toFixed(1)).toString();
  return formatted + (variable.isPercentage ? "%" : "");
}

function lookup(payload: Record<string, unknown>, name: string, level: number): unknown {
  // Game's leveled-value fallback: variableName "x,y" parses as constant + scale.
  if (name.includes(",")) {
    const [a, b] = name.split(",").map(Number);
    return (a ?? 0) + (b ?? 0) * level;
  }
  if (Object.hasOwn(payload, name)) return payload[name];
  // Method-style fallback: some C# fields are accessed via methods like TotalDeltaTooltip(level, duration).
  // We expose those as properties on the payload via the mod's effect serializer.
  return undefined;
}

function toNumber(value: unknown, level: number): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "object" && value !== null) {
    const wrapper = value as { value?: unknown; baseValue?: unknown; levelScale?: unknown };
    if (typeof wrapper.value === "number") return wrapper.value; // CharacterModFloat / CharacterModInt
    if (typeof wrapper.baseValue === "number") {
      // LeveledFloat / LeveledInt → BaseValue + LevelScale * level
      const scale = typeof wrapper.levelScale === "number" ? wrapper.levelScale : 0;
      return wrapper.baseValue + scale * level;
    }
  }
  return undefined;
}

function isStatusEffectLike(value: unknown): boolean {
  if (Array.isArray(value))
    return (
      value.length > 0 &&
      typeof value[0] === "object" &&
      (value[0] as Record<string, unknown>)?.statusEffectRef !== undefined
    );
  if (typeof value === "object" && value !== null)
    return (value as Record<string, unknown>).statusEffectRef !== undefined;
  return false;
}

// ---

export function applyColors(text: string, vocabulary: MasterTooltipVocabulary): string {
  if (text == null) return "";
  // Partial passes for the four reserved single-character codes (l, t, n, p).
  text = applyColorPartial(text, "l", vocabulary.tooltipDurationColor);
  text = applyColorPartial(text, "t", vocabulary.tooltipTargetColor);
  text = applyColorPartial(text, "n", vocabulary.negativeColor);
  text = applyColorPartial(text, "p", vocabulary.positiveColor);
  // Close-bracket sweep.
  text = text.replaceAll("]", "</color>");
  // tooltipColors expansion.
  for (const [code, entry] of Object.entries(vocabulary.tooltipColors)) {
    text = applyColor(text, code, entry.text, entry.color);
  }
  // tooltipCodes substitution.
  for (const [code, replacement] of Object.entries(vocabulary.tooltipCodes)) {
    text = text.replaceAll(code, replacement);
  }
  return text;
}

function applyColor(text: string, code: string, label: string, color: string): string {
  return text.replaceAll(code, `<color=${color}>${label}</color>`);
}

function applyColorPartial(
  text: string,
  code: string,
  color: { r: number; g: number; b: number; a: number },
): string {
  const hex = colorToHex(color);
  return text.replaceAll(`[${code} `, `<color=${hex}>`);
}

function colorToHex(c: { r: number; g: number; b: number; a: number }): string {
  const toByte = (v: number) =>
    Math.round(Math.max(0, Math.min(1, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toByte(c.r)}${toByte(c.g)}${toByte(c.b)}`;
}
```

- [ ] **Step 3: Run + commit**

Run: `bun test pipeline/test/composer/string-tooltip.test.ts`
Expected: PASS (every case).

```sh
git add pipeline/src/composer/composer-context.ts pipeline/src/composer/string-tooltip.ts pipeline/test/composer/string-tooltip.test.ts
git commit -m "feat(pipeline): port StringTooltip to typescript"
```

### Task 9.3: `master-data.ts` — port `ApplyColorCodes`

**Files:**

- Create: `pipeline/src/composer/master-data.ts`
- Test: `pipeline/test/composer/master-data.test.ts`

`ArdenfallMasterData.ApplyColorCodes` (`.decompiled/.../ArdenfallMasterData.cs:229-268`) is a separate pass that walks the term-set regex, substitutes `<link="term_...">` markers, and applies term-set colors.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "bun:test";
import { applyColorCodes } from "$pipeline/composer/master-data";

const vocab = /* a MasterTooltipVocabulary with one term set */;

describe("applyColorCodes", () => {
  it("substitutes a term match into a link", () => {
    const out = applyColorCodes("Restores {stamina} for {lifetime}.", {
      ...vocab,
      tooltipCodes: { stamina: "Stamina" },
      globalTermSets: [
        { setId: "stamina", terms: ["Stamina"], regex: "\\bStamina\\b", replacement: "<link=\"term_stamina\">$&</link>" },
      ],
      termColorMatch: "",
    });
    expect(out).toContain("<link=\"term_stamina\">Stamina</link>");
  });

  it("leaves untargeted text alone", () => {
    expect(applyColorCodes("plain text", { ...vocab, globalTermSets: [] })).toBe("plain text");
  });
});
```

- [ ] **Step 2: Implement**

```ts
// pipeline/src/composer/master-data.ts
import type { MasterTooltipVocabulary } from "../types.ts";

export function applyColorCodes(input: string, vocabulary: MasterTooltipVocabulary): string {
  let out = input;
  for (const set of vocabulary.globalTermSets) {
    if (!set.regex || !set.replacement) continue;
    try {
      const re = new RegExp(set.regex, "g");
      out = out.replace(re, set.replacement);
    } catch {
      // Bad regex; skip silently — diagnostic is raised in load-snapshot validation.
    }
  }
  return out;
}
```

- [ ] **Step 3: Run + commit**

```sh
git add pipeline/src/composer/master-data.ts pipeline/test/composer/master-data.test.ts
git commit -m "feat(pipeline): port ApplyColorCodes term-set pass"
```

### Task 9.4: Per-effect-kind Zod schemas — initial set + index

**Files:**

- Create: `pipeline/src/composer/effect-kinds/index.ts` (registry)
- Create: `pipeline/src/composer/effect-kinds/<Kind>.zod.ts` for each kind in the initial set
- Test: `pipeline/test/composer/effect-kinds.test.ts`

Initial set (chosen because they appear in `BaseItem.GetEffectsTooltip` chains for consumables, throwing potions, melee/armor enchantments, and slate-spell tooltips):

`DamageEffect`, `ModStatEffect`, `ModMaxStatEffect`, `ModPerSecondEffect`, `GeneralCharacterModEffect`, `ScaleDamageByStatEffect`, `ScaleDamageEffect`, `DamageTypeResistEffect`, `KnockbackEffect`, `MovementSpeedEffect`, `CarryWeightEffect`, `AnimationSpeedEffect`, `AddEffectOnWeatherEffect`, `StunEffect`, `WeaponKnockbackEffect`, `WeaponModificationEffect`.

(Phase 10's status-effect emission step expands the registry as the live audit reveals more kinds.)

The shared shape:

```ts
// pipeline/src/composer/effect-kinds/_shared.ts
import { z } from "zod";

export const LeveledFloatSchema = z.object({
  baseValue: z.number(),
  levelScale: z.number(),
});

export const LeveledIntSchema = z.object({
  baseValue: z.number().int(),
  levelScale: z.number().int(),
});

export const SnapshotRefSchema = z.union([
  z.object({ kind: z.literal("lookupAsset"), guid: z.string() }),
  z.object({ kind: z.literal("missing"), reason: z.string(), source: z.string() }),
  z.null(),
]);

export const StackModeSchema = z.object({
  type: z.string(),
  addLevel: z.number(),
  maxLevel: z.number(),
});

export const LeveledStatusEffectSchema = z.object({
  statusEffectRef: SnapshotRefSchema,
  level: z.number(),
  lifetime: z.number(),
  stackMode: StackModeSchema.nullable(),
});

export const LeveledLeveledStatusEffectSchema = z.object({
  statusEffectRef: SnapshotRefSchema,
  level: LeveledFloatSchema.nullable(),
  lifetime: LeveledFloatSchema.nullable(),
  stackMode: StackModeSchema.nullable(),
});

export const CharacterModFloatSchema = z.object({
  value: z.number(),
  isPercentage: z.boolean(),
  isMultiplier: z.boolean(),
});

export const CharacterModIntSchema = z.object({
  value: z.number().int(),
  isPercentage: z.boolean(),
  isMultiplier: z.boolean(),
});
```

Then one file per kind. Example:

```ts
// pipeline/src/composer/effect-kinds/DamageEffect.zod.ts
import { z } from "zod";
import { LeveledFloatSchema } from "./_shared.ts";

export const DamageEffectPayload = z.object({
  damageValue: LeveledFloatSchema,
  damageType: z.string(),
});

export type DamageEffectPayload = z.infer<typeof DamageEffectPayload>;
```

```ts
// pipeline/src/composer/effect-kinds/ModStatEffect.zod.ts
import { z } from "zod";
import { LeveledFloatSchema, SnapshotRefSchema } from "./_shared.ts";

export const ModStatEffectPayload = z.object({
  stat: SnapshotRefSchema,
  modification: LeveledFloatSchema,
  addition: z.boolean(),
});

export type ModStatEffectPayload = z.infer<typeof ModStatEffectPayload>;
```

Write similar files for the remaining 14 kinds in the initial set. Each file is ~10 lines.

Registry:

```ts
// pipeline/src/composer/effect-kinds/index.ts
import { z } from "zod";
import { DamageEffectPayload } from "./DamageEffect.zod.ts";
import { ModStatEffectPayload } from "./ModStatEffect.zod.ts";
// ... import each kind ...

export const EffectKindRegistry = {
  DamageEffect: DamageEffectPayload,
  ModStatEffect: ModStatEffectPayload,
  // ... all kinds ...
} as const;

export type EffectKind = keyof typeof EffectKindRegistry;

export function validateEffectPayload(
  kind: string,
  payload: unknown,
): { ok: true; data: unknown } | { ok: false; errors: string[] } {
  const schema = (EffectKindRegistry as Record<string, z.ZodTypeAny>)[kind];
  if (!schema) return { ok: false, errors: [`unknown-effect-kind: ${kind}`] };
  const result = schema.safeParse(payload);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, errors: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
}
```

- [ ] **Step 1: Write the registry test**

```ts
import { describe, expect, it } from "bun:test";
import { validateEffectPayload } from "$pipeline/composer/effect-kinds";

describe("validateEffectPayload", () => {
  it("validates a ModStatEffect payload", () => {
    const result = validateEffectPayload("ModStatEffect", {
      stat: { kind: "lookupAsset", guid: "fixture-strength" },
      modification: { baseValue: 2, levelScale: 0.5 },
      addition: true,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects an unknown kind", () => {
    const result = validateEffectPayload("MysteryEffect", {});
    expect(result.ok).toBe(false);
  });

  it("reports issue paths", () => {
    const result = validateEffectPayload("ModStatEffect", {
      stat: null,
      modification: "wrong",
      addition: 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain("modification");
  });
});
```

- [ ] **Step 2: Implement schemas + registry**

(Implement all the per-kind schemas + index file as shown above.)

- [ ] **Step 3: Run + commit**

```sh
git add pipeline/src/composer/effect-kinds/ pipeline/test/composer/effect-kinds.test.ts
git commit -m "feat(pipeline): effect kind schemas (initial set)"
```

### Task 9.5: Golden-file harness

**Files:**

- Create: `pipeline/src/composer/golden/snapshot.ts`
- Create: `pipeline/test/composer/golden.test.ts`
- Create: `fixtures/golden/0.0.10.91-anchor/README.md` (explains the capture process)

The harness compares composer output against captured strings:

```ts
// pipeline/src/composer/golden/snapshot.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface GoldenSnapshot {
  patch: string;
  entityType: "status-effect" | "spell" | "enchantment" | "item";
  ownerId: string;
  level: number;
  lifetime: number;
  targetSelf: boolean;
  expected: string; // TMP-flavoured string captured from the game
}

export function loadGolden(patch: string, entityType: string, ownerId: string): GoldenSnapshot {
  const path = join("fixtures", "golden", patch, entityType, `${ownerId}.json`);
  const body = JSON.parse(readFileSync(path, "utf8")) as GoldenSnapshot;
  return body;
}

export function compareToGolden(actual: string, expected: string): { ok: boolean; diff?: string } {
  if (actual === expected) return { ok: true };
  return {
    ok: false,
    diff: makeDiff(actual, expected),
  };
}

function makeDiff(actual: string, expected: string): string {
  // Simple line-level diff that surfaces every change for debugging.
  const a = actual.split("\n");
  const e = expected.split("\n");
  const lines: string[] = [];
  const max = Math.max(a.length, e.length);
  for (let i = 0; i < max; i++) {
    if (a[i] === e[i]) continue;
    lines.push(`- expected: ${JSON.stringify(e[i])}`);
    lines.push(`+ actual:   ${JSON.stringify(a[i])}`);
  }
  return lines.join("\n");
}
```

The capture process is documented in `fixtures/golden/0.0.10.91-anchor/README.md`:

> Goldens are captured via a one-time mod hook (see Phase 10 Task 10.X) that calls `BaseItem.GetEffectsTooltip()` / `StatusEffectData.GetTooltip()` / `SpellData.GetTooltip()` / `EnchantmentData.GetTooltip()` on every public asset and dumps the result into per-entity files. Recapture happens automatically per patch upgrade; the diff against the previous patch's goldens is the patch's tooltip changelog.

- [ ] **Step 1: Write the harness test**

```ts
// pipeline/test/composer/golden.test.ts
import { describe, expect, it } from "bun:test";
import { compareToGolden } from "$pipeline/composer/golden/snapshot";

describe("compareToGolden", () => {
  it("returns ok=true for byte-equal", () => {
    expect(compareToGolden("hello", "hello").ok).toBe(true);
  });

  it("returns diff when mismatched", () => {
    const result = compareToGolden("foo", "bar");
    expect(result.ok).toBe(false);
    expect(result.diff).toContain("expected");
  });
});
```

- [ ] **Step 2: Commit**

```sh
git add pipeline/src/composer/golden/ pipeline/test/composer/golden.test.ts fixtures/golden/0.0.10.91-anchor/README.md
git commit -m "feat(pipeline): composer golden file harness"
```

### Task 9.6: Phase 9 verification gate

- [ ] Run the standard phase gate (no mod work; pipeline + site tests run).
- [ ] Confirm the `pipeline/src/composer/` directory has all the listed files.
- [ ] Update coordinator phase index row 9 status to ✅.

---

## Checkpoint 3: end of "composer foundation" group

After Phase 9, **stop and review** before opening Phase 10. The composer's `StringTooltip` port + per-kind schema registry + golden harness are proven against synthetic inputs. Phase 10 wires them up to real `StatusEffectData` extraction and the first batch of real goldens.

---

[← Previous phase](08-variable-binding-audit.md) · [Next phase →](10-status-effect.md) · [Coordinator](../2026-05-20-items-presentation-closure.md)
