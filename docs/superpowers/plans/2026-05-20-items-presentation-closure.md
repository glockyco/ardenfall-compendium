# Items Presentation Closure (Slice 4.5) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the deterministic-presentation gap on items by extracting every entity items transitively reference (status effects, spells, enchantments, stat types, item categories, item tags, potion recipes, master-tooltip vocabulary), porting the game's tooltip composition methods to TypeScript, materialising the new entity pages on the static site, and cutting items over to SEO-friendly slug routes with legacy GUID redirects — without leaving any half-resolved link in production.

**Architecture:** Mod extracts seven new entity types plus a private master-tooltip vocabulary singleton via a generic reflection-based `Effect` / `SpellEffect` / `EnchantmentEffect` serializer; pipeline canonicalises each entity, runs a TypeScript port of the game's `StringTooltip` / `StatusEffectTooltip` / `SpellTooltip` / `EnchantmentTooltip` / `ArdenfallMasterData.ApplyColorCodes` chain over the typed snapshots, and emits per-entity overview + presentation read-models plus a `<slug>--<id8>` routing scheme; SvelteKit prerenders the new detail pages and a Cloudflare `_redirects` map preserves legacy item GUID URLs. Golden-file parity tests against captured in-game tooltip strings gate the composer.

**Tech Stack:** BepInEx 5 mod (C# / netstandard2.1), Newtonsoft.Json, Ardenfall asset reflection. Bun-based pipeline (TypeScript, Zod, better-sqlite3, Ajv). SvelteKit 2 / Svelte 5 site on Cloudflare Workers Static Assets via `adapter-cloudflare`. xUnit on the mod side, Bun test on everything else.

**Reference spec:** `docs/superpowers/specs/2026-05-20-items-presentation-closure-design.md`.
**Supporting documents:** `2026-05-20-item-asset-graph-audit.md`, `2026-05-20-compendium-architecture-survey.md`, `2026-05-20-items-presentation-closure-architecture-review.md`.

---

## Pre-flight

### How this plan is executed

- Each phase is a self-contained release-candidate: it ends with a green local gate run (`bun run codegen:validators && bun run check:fixtures && dotnet test mod-tests/ArdenfallCompendium.Tests.csproj && bun test pipeline/test && bun test tooling.test.ts && bun test controller/test && bun run typecheck && bun run --cwd site check`) and at least one commit. **Never close a phase with red gates.**
- Phases are sequential. Dependent phases assume their predecessors are green.
- Subagent-driven execution is recommended (`superpowers:subagent-driven-development`): fresh subagent per task, two-stage review between tasks, batch only within a single phase.
- The user pre-pushes commits between phases at their discretion; never push without explicit approval.

### Repository invariants the plan assumes

- Pipeline canonical tables live under `pipeline/src/sql/ddl.ts` and `pipeline/src/sql/site-metadata-ddl.ts`; read-model DDL lives in `pipeline/src/stages/emit-read-models.ts`. Schema migrations happen by replacing the DDL — there is no online migration story; the artifact is rebuilt from scratch.
- All `*.ts` files use ESM, top-level `await` where needed, `bun` runtime, no Node-only APIs.
- All `*.cs` files target netstandard2.1 (`mod/ArdenfallCompendium.csproj`); the test project targets the BepInEx-compatible profile under `mod-tests/`.
- Site routes follow SvelteKit 2 conventions: `+page.server.ts` is the data source, `+page.svelte` the renderer; `export const prerender = true` flips the route to static.
- Schemas under `schemas/*.schema.json` regenerate validators via `bun run codegen:validators` — never edit `pipeline/dist/validate-*.mjs` by hand.

### Verification gates that apply to every phase

Unless a task explicitly overrides, every phase ends with this verification sweep:

```sh
bun run codegen:validators
bun run check:fixtures
dotnet test mod-tests/ArdenfallCompendium.Tests.csproj
bun test pipeline/test
bun test tooling.test.ts
bun test controller/test
bun run typecheck
bun run --cwd site check
bun run format:check
bun run lint
git diff --check
```

A phase that touches the site build also runs:

```sh
bun run artifact:fixture synthetic fixtures/synthetic/snapshot
NODE_OPTIONS=--max-old-space-size=8192 bun run --cwd site build:fixture
bun run --cwd site smoke:prerender
bun run --cwd site smoke:item-icons
```

### Phase decomposition

The plan has 17 phases. Each maps to a section of the design spec.

| #   | Phase                                                             | Spec §           | Scope summary                                                                                                                                                                          |
| --- | ----------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Master-tooltip vocabulary v2                                      | §4.2, §3.3       | Extend the private singleton with the full vocabulary the composer needs.                                                                                                              |
| 2   | Slug + ID8 routing core                                           | §4.6             | `entity_nodes.short_id` column, slug derivation, slug uniqueness audit, route resolver helper, redirect machinery — without cutting any route over yet.                                |
| 3   | New-entity scaffolding                                            | §4.1             | Shared infrastructure: descriptor schema, snapshot envelope shape, validation contract, fixtures common to the seven new entities.                                                     |
| 4   | `stat-type` entity                                                | §3.2             | Mod export + pipeline canonical + read-model + public detail/overview routes.                                                                                                          |
| 5   | `item-category` entity                                            | §3.2             | Same shape as Phase 4, plus exposing `categoryColor` to the icon tint path.                                                                                                            |
| 6   | `item-tag` entity                                                 | §3.2             | Same shape, with the description carrying the in-game tag-row text.                                                                                                                    |
| 7   | Generic effect serializer (mod)                                   | §4.4, §6.6       | Reflection-based serializer with typed wrapper handlers, deny-list of leaf types, recursive expansion into `LeveledStatusEffect` wrappers.                                             |
| 8   | Variable-binding audit (mod)                                      | §7.7             | Per-extraction sweep emitting `effect-bindings-audit.json`; pipeline diagnostics on unresolved bindings.                                                                               |
| 9   | Composer port — `string-tooltip` + `master-data` + golden harness | §4.3, §7.1, §7.2 | Pure TS ports of the two color/template passes; per-effect-kind Zod schemas; golden-snapshot test infrastructure.                                                                      |
| 10  | `status-effect` entity + composer port                            | §3.2, §4.3, §7.3 | Full `StatusEffectData` extraction, `Effect[]` payloads, `tooltipTemplate` + variables, composer wiring, read-model, site pages.                                                       |
| 11  | `spell` entity + composer port                                    | §3.2, §4.3, §7.4 | Same for `SpellData`, `SpellEffect[]`, `subSpells`, primary/secondary level handling, spell-prefix wrap.                                                                               |
| 12  | `enchantment` entity + composer port                              | §3.2, §4.3, §7.5 | Same for `EnchantmentData`, `EnchantmentEffect[]`, `targetVars` wholesale-replacement semantics, suppression flags.                                                                    |
| 13  | `potion-recipe` entity                                            | §3.2             | Full extraction including ingredient tag-refs, derived recipe name, read-model, site pages.                                                                                            |
| 14  | Item re-extraction + presentation re-composer                     | §3.1, §6.5       | Per-variant catch-up (`hardAttackDamMult`, `enchantments[]`, full statTypeRef), pre-computed per-variant `stat_rows_json`, item presentation composer reading through new entities.    |
| 15  | Relationship graph rebuild                                        | §4.5             | Single canonical `entity_edges` table with dual indexes, full predicate vocabulary, forward + reverse `entity_relationship_sections` materialisation, slug-aware audit.                |
| 16  | Item route cutover + legacy redirects                             | §8.2             | `entity_nodes.route_path` / `canonical_slug` switched to `<slug>--<id8>` for items; SvelteKit route swaps `[id]` to `[slug]`; Cloudflare `_redirects` emitted from `entity_redirects`. |
| 17  | SEO hygiene + final verification + release                        | §8.3, §10        | JSON-LD on every entity page, sitemap regeneration, IndexNow ping, fresh live export, release artifact, deploy, production smoke, roadmap closeout.                                    |

---

## Phase 1: Master-tooltip vocabulary v2

**Spec coverage:** §4.2 (singleton), §3.3 (two-pass colour expansion).

**Why first:** the composer cannot start until the master-tooltip vocabulary singleton carries every field `StringTooltip.ApplyColors`, `ArdenfallMasterData.ApplyColorCodes`, and `SpellData.GetTooltip` actually read. Today's `MasterTooltipDictionary` carries only `tooltipCodes` + a single-string `tooltipColors`; the live game uses `tooltipColors: {code, color, text}[]`, plus target/duration/positive/negative colours, plus term-set regex tables, plus spell prefixes, plus the `PotionRecipeManager.potionRecipeDescription` runtime string.

**Outcome:** `master-tooltip.json` snapshot envelope at schema version 2, validated by a dedicated JSON Schema, loaded into a typed `MasterTooltipVocabulary` object, surfaced to every pipeline stage that needs it. No site changes yet.

### Task 1.1: JSON Schema for `master-tooltip.json` v2

**Files:**

- Create: `schemas/master-tooltip.schema.json`
- Modify: `pipeline/scripts/codegen-validators.ts` (add the new schema to the generator list)
- Test: `pipeline/test/master-tooltip-schema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// pipeline/test/master-tooltip-schema.test.ts
import { describe, expect, it } from "bun:test";
import validate from "$pipeline/../dist/validate-master-tooltip.mjs";

const valid = {
  schemaVersion: 2,
  tooltipCodes: { stamina: "Stamina" },
  tooltipColors: { p: { color: "#6FCF6F", text: "positive" } },
  tooltipTargetColor: { r: 1, g: 1, b: 1, a: 1 },
  tooltipDurationColor: { r: 1, g: 1, b: 1, a: 1 },
  positiveColor: { r: 0.43, g: 0.81, b: 0.43, a: 1 },
  negativeColor: { r: 0.95, g: 0.36, b: 0.36, a: 1 },
  spellSubEffectColor: { r: 0.8, g: 0.8, b: 0.8, a: 1 },
  enchantmentItemColor: { r: 0.55, g: 0.78, b: 0.85, a: 1 },
  primarySpellTooltip: "<b>{0}</b>\n{1}",
  secondarySpellTooltip: "<b>Secondary:</b> {0}\n{1}",
  unmetSkillMessage: "You lack the required skill: {0}",
  brokenDurabilityMessage: "This item is broken.",
  ruinedDurabilityMessage: "This item is ruined.",
  statBookMessage: "Reading this grants {0}.",
  termSetColors: {},
  globalTermSets: [],
  termColorMatch: "\\{([a-zA-Z0-9_]+)\\}",
  potionRecipeDescription: "Learn the potion recipe {0}.",
};

describe("master-tooltip v2 schema", () => {
  it("accepts a complete vocabulary", () => {
    expect(validate(valid)).toBe(true);
  });

  it("rejects schemaVersion 1", () => {
    expect(validate({ ...valid, schemaVersion: 1 })).toBe(false);
  });

  it("rejects missing positiveColor", () => {
    const { positiveColor, ...rest } = valid;
    expect(validate(rest)).toBe(false);
  });

  it("rejects a string tooltipColors value (v1 shape)", () => {
    expect(validate({ ...valid, tooltipColors: { p: "positive" } })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test pipeline/test/master-tooltip-schema.test.ts`
Expected: FAIL — `dist/validate-master-tooltip.mjs` does not exist yet.

- [ ] **Step 3: Create the schema**

```json
// schemas/master-tooltip.schema.json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://ardenfall-compendium.example/schemas/master-tooltip.schema.json",
  "title": "Master tooltip vocabulary",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schemaVersion",
    "tooltipCodes",
    "tooltipColors",
    "tooltipTargetColor",
    "tooltipDurationColor",
    "positiveColor",
    "negativeColor",
    "spellSubEffectColor",
    "enchantmentItemColor",
    "primarySpellTooltip",
    "secondarySpellTooltip",
    "unmetSkillMessage",
    "brokenDurabilityMessage",
    "ruinedDurabilityMessage",
    "statBookMessage",
    "termSetColors",
    "globalTermSets",
    "termColorMatch",
    "potionRecipeDescription"
  ],
  "properties": {
    "schemaVersion": { "const": 2 },
    "tooltipCodes": {
      "type": "object",
      "additionalProperties": { "type": "string" }
    },
    "tooltipColors": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "additionalProperties": false,
        "required": ["color", "text"],
        "properties": {
          "color": { "type": "string", "pattern": "^#[0-9A-Fa-f]{6}$" },
          "text": { "type": "string" }
        }
      }
    },
    "tooltipTargetColor": { "$ref": "#/$defs/color" },
    "tooltipDurationColor": { "$ref": "#/$defs/color" },
    "positiveColor": { "$ref": "#/$defs/color" },
    "negativeColor": { "$ref": "#/$defs/color" },
    "spellSubEffectColor": { "$ref": "#/$defs/color" },
    "enchantmentItemColor": { "$ref": "#/$defs/color" },
    "primarySpellTooltip": { "type": "string" },
    "secondarySpellTooltip": { "type": "string" },
    "unmetSkillMessage": { "type": "string" },
    "brokenDurabilityMessage": { "type": "string" },
    "ruinedDurabilityMessage": { "type": "string" },
    "statBookMessage": { "type": "string" },
    "termSetColors": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "additionalProperties": false,
        "required": ["color", "text"],
        "properties": {
          "color": { "type": "string", "pattern": "^#[0-9A-Fa-f]{6}$" },
          "text": { "type": "string" }
        }
      }
    },
    "globalTermSets": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["setId", "terms", "regex", "replacement"],
        "properties": {
          "setId": { "type": "string", "minLength": 1 },
          "terms": { "type": "array", "items": { "type": "string" } },
          "regex": { "type": "string" },
          "replacement": { "type": "string" }
        }
      }
    },
    "termColorMatch": { "type": "string" },
    "potionRecipeDescription": { "type": "string" }
  },
  "$defs": {
    "color": {
      "type": "object",
      "additionalProperties": false,
      "required": ["r", "g", "b", "a"],
      "properties": {
        "r": { "type": "number", "minimum": 0, "maximum": 1 },
        "g": { "type": "number", "minimum": 0, "maximum": 1 },
        "b": { "type": "number", "minimum": 0, "maximum": 1 },
        "a": { "type": "number", "minimum": 0, "maximum": 1 }
      }
    }
  }
}
```

- [ ] **Step 4: Wire schema into the codegen generator**

Locate the schemas array in `pipeline/scripts/codegen-validators.ts` and add the new entry. Read the file first to confirm the exact shape; the addition is a single object literal `{ source: "schemas/master-tooltip.schema.json", output: "dist/validate-master-tooltip.mjs", typeName: "MasterTooltipVocabulary" }`.

- [ ] **Step 5: Regenerate validators**

Run: `bun run codegen:validators`
Expected: writes `pipeline/dist/validate-master-tooltip.mjs` and `.d.mts`.

- [ ] **Step 6: Run test to verify it passes**

Run: `bun test pipeline/test/master-tooltip-schema.test.ts`
Expected: all 4 cases PASS.

- [ ] **Step 7: Commit**

```sh
git add schemas/master-tooltip.schema.json pipeline/scripts/codegen-validators.ts pipeline/dist/validate-master-tooltip.mjs pipeline/dist/validate-master-tooltip.d.mts pipeline/test/master-tooltip-schema.test.ts
git commit -m "feat(pipeline): validate master tooltip v2 schema"
```

### Task 1.2: TypeScript model + `load-snapshot` integration

**Files:**

- Modify: `pipeline/src/types.ts:185-200` (replace `MasterTooltipDictionary` with `MasterTooltipVocabulary` and helpers)
- Modify: `pipeline/src/stages/load-snapshot.ts:1-100` (parse + validate v2; fail on v1)
- Test: `pipeline/test/snapshot.test.ts` (extend the master-tooltip section)

- [ ] **Step 1: Write the failing test**

Append the following inside `pipeline/test/snapshot.test.ts` under the existing `loadSnapshot` `describe`:

```ts
it("loads the master tooltip vocabulary at schemaVersion 2", async () => {
  const out = await loadSnapshot.run({}, ctx);
  const v = out.masterTooltip;
  if (!v) throw new Error("master tooltip vocabulary missing");
  expect(v.schemaVersion).toBe(2);
  expect(v.tooltipColors.p?.text).toBe("positive");
  expect(v.positiveColor.r).toBeGreaterThan(0);
  expect(v.primarySpellTooltip.length).toBeGreaterThan(0);
  expect(v.potionRecipeDescription).toContain("{0}");
});

it("rejects a v1 master tooltip dictionary as unsupported", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ardenfall-v1-mt-"));
  try {
    writeFileSync(
      join(dir, "manifest.json"),
      readFileSync("fixtures/synthetic/snapshot/manifest.json", "utf8"),
    );
    writeFileSync(
      join(dir, "asset-manifest.json"),
      readFileSync("fixtures/synthetic/snapshot/asset-manifest.json", "utf8"),
    );
    writeFileSync(
      join(dir, "items.json"),
      readFileSync("fixtures/synthetic/snapshot/items.json", "utf8"),
    );
    writeFileSync(
      join(dir, "master-tooltip.json"),
      JSON.stringify({ schemaVersion: 1, tooltipCodes: {}, tooltipColors: {} }),
    );
    await expect(loadSnapshot.run({}, { ...ctx, snapshotDir: dir })).rejects.toThrow(
      /master tooltip.*schemaVersion/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test pipeline/test/snapshot.test.ts`
Expected: FAIL — `out.masterTooltip` matches v1 shape; `schemaVersion` is `1`.

- [ ] **Step 3: Replace the TypeScript model**

In `pipeline/src/types.ts`, replace the existing `MasterTooltipDictionary` block (currently lines ~187-191) with:

```ts
export interface MasterTooltipVocabulary {
  schemaVersion: 2;
  tooltipCodes: Record<string, string>;
  tooltipColors: Record<string, MasterTooltipColorToken>;
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
  termSetColors: Record<string, MasterTooltipColorToken>;
  globalTermSets: MasterTooltipTermSet[];
  termColorMatch: string;
  potionRecipeDescription: string;
}

export interface MasterTooltipColorToken {
  color: string;
  text: string;
}

export interface MasterTooltipTermSet {
  setId: string;
  terms: string[];
  regex: string;
  replacement: string;
}

export interface ColorSnapshot {
  r: number;
  g: number;
  b: number;
  a: number;
}
```

If `ColorSnapshot` already exists elsewhere in `types.ts`, do not re-declare it; reuse the existing one. Verify by `search` for `interface ColorSnapshot|type ColorSnapshot` in `pipeline/src/types.ts`.

- [ ] **Step 4: Update `load-snapshot.ts`**

Replace the `MasterTooltipDictionary` import with `MasterTooltipVocabulary`. Replace the v1 validation block with the v2 validator:

```ts
import validateMasterTooltip from "../../dist/validate-master-tooltip.mjs";
// ...
import type {
  // ...
  MasterTooltipVocabulary,
  // ...
} from "../types.ts";

export interface LoadSnapshotOutput {
  // ...
  masterTooltip?: MasterTooltipVocabulary;
}
// ...
if (existsSync(masterTooltipPath)) {
  const raw = JSON.parse(readFileSync(masterTooltipPath, "utf8")) as unknown;
  if (!validateMasterTooltip(raw)) {
    const detail = (validateMasterTooltip.errors ?? [])
      .map((e) => `${masterTooltipPath}#${e.instancePath} — ${e.message}`)
      .join("\n");
    throw new Error(
      `invalid master tooltip vocabulary at ${masterTooltipPath} (expected schemaVersion 2):\n${detail}`,
    );
  }
  masterTooltip = raw as MasterTooltipVocabulary;
}
```

- [ ] **Step 5: Update the fixture to v2**

Replace `fixtures/synthetic/snapshot/master-tooltip.json` with the complete v2 example used in the Task 1.1 test (same content). Run `bun run check:fixtures` and let it tell you the new fixture-manifest hash; update `fixtures/synthetic/manifest.json` and `fixtures/synthetic/snapshot/manifest.json` `hashes` to match.

- [ ] **Step 6: Run test to verify it passes**

Run: `bun test pipeline/test/snapshot.test.ts`
Expected: PASS (both new cases + the existing presentation cases).

- [ ] **Step 7: Run the full pipeline test suite**

Run: `bun test pipeline/test`
Expected: PASS. If `rich-text-v1.test.ts` fails because the tooltipColors shape changed, that is captured in Task 1.3 — leave it failing here so Task 1.3 picks it up.

- [ ] **Step 8: Commit**

```sh
git add pipeline/src/types.ts pipeline/src/stages/load-snapshot.ts pipeline/test/snapshot.test.ts fixtures/synthetic/snapshot/master-tooltip.json fixtures/synthetic/snapshot/manifest.json fixtures/synthetic/manifest.json
git commit -m "feat(pipeline): load master tooltip vocabulary v2"
```

### Task 1.3: Propagate the new `tooltipColors` shape through `rich-text-v1`

**Files:**

- Modify: `pipeline/src/rich-text/rich-text-v1.ts` (consume the v2 shape — `{color, text}` instead of bare string)
- Modify: `pipeline/test/rich-text-v1.test.ts`
- Modify: `pipeline/src/stages/emit-read-models.ts` (caller site for the composer)

- [ ] **Step 1: Adapt the rich-text test to the new shape**

Find the existing `tooltipColors` test case in `pipeline/test/rich-text-v1.test.ts` and replace any `tooltipColors: { p: "positive" }` with `tooltipColors: { p: { color: "#6FCF6F", text: "positive" } }`. Where the test checked that `token` was `"positive"`, change the expectation to `token: "positive"` (extracted from `.text`) and `color: "#6FCF6F"` (carried alongside).

- [ ] **Step 2: Run test to confirm it now fails against the current implementation**

Run: `bun test pipeline/test/rich-text-v1.test.ts`
Expected: FAIL — the translator still treats `tooltipColors[code]` as a string.

- [ ] **Step 3: Update the translator**

In `pipeline/src/rich-text/rich-text-v1.ts`, change every `options.tooltipColors?.[code]` access from `string` to `{color, text}`. The `translateTooltipColor` helper now emits:

```ts
function translateTooltipColor(
  token: string,
  tooltipColors: Record<string, MasterTooltipColorToken> | undefined,
  diagnostic: (code: string, message: string, field?: string) => void,
): RichTextNode | null {
  const match = /^\[([A-Za-z])\s+([^\]]+)\]$/.exec(token);
  if (!match) return null;
  const code = match[1]!;
  const entry = tooltipColors?.[code];
  if (!entry) {
    diagnostic(
      "unresolvedTooltipColor",
      `Tooltip color code '${code}' is not present in the master tooltip vocabulary.`,
    );
    return null;
  }
  return {
    type: "color",
    token: entry.text,
    color: entry.color,
    children: [{ type: "text", text: match[2]! }],
  };
}
```

Import `MasterTooltipColorToken` from `../types.ts`. Update the `RichTextOptions` type:

```ts
export type RichTextOptions = {
  tooltipCodes?: Record<string, string>;
  tooltipColors?: Record<string, MasterTooltipColorToken>;
  resolveTerm?: (termId: string, label: string) => TermResolution | undefined;
};
```

- [ ] **Step 4: Update read-model emission**

In `pipeline/src/stages/emit-read-models.ts`, every site that builds `RichTextOptions` from `masterTooltip` already reads `masterTooltip?.tooltipColors` directly — no change needed once `tooltipColors` is the new shape, because the translator now expects the new shape.

Re-read `pipeline/src/stages/emit-read-models.ts` and confirm no callsite passes a `Record<string, string>` literal directly. If any does, adjust accordingly.

- [ ] **Step 5: Run test to verify pipeline + read-model tests pass**

Run: `bun test pipeline/test/rich-text-v1.test.ts pipeline/test/read-models.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full pipeline suite**

Run: `bun test pipeline/test`
Expected: PASS.

- [ ] **Step 7: Commit**

```sh
git add pipeline/src/rich-text/rich-text-v1.ts pipeline/src/stages/emit-read-models.ts pipeline/test/rich-text-v1.test.ts
git commit -m "refactor(pipeline): consume master tooltip color tokens"
```

### Task 1.4: Mod-side `MasterTooltipExtractor`

**Files:**

- Create: `mod/src/MasterTooltip/MasterTooltipExtractor.cs`
- Create: `mod/src/MasterTooltip/MasterTooltipVocabularySnapshot.cs` (DTO)
- Create: `mod-tests/MasterTooltipExtractorTests.cs`
- Modify: `mod/src/Entities/ItemExtractionService.cs` (or wherever artifact emission orchestrates — read first to confirm) so the master-tooltip artifact is emitted alongside item snapshots.

- [ ] **Step 1: Write the failing test**

```cs
// mod-tests/MasterTooltipExtractorTests.cs
using ArdenfallCompendium.MasterTooltip;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class MasterTooltipExtractorTests
{
    [Fact]
    public void EmitsSchemaVersion2WithPositiveAndNegativeColors()
    {
        var snapshot = MasterTooltipExtractor.Build(FakeMasterData.Sample, FakeMasterData.PotionRecipeDescription);
        Assert.Equal(2, snapshot.SchemaVersion);
        Assert.NotEmpty(snapshot.TooltipColors);
        Assert.True(snapshot.TooltipColors.ContainsKey("p"));
        Assert.Equal("positive", snapshot.TooltipColors["p"].Text);
        Assert.True(snapshot.PositiveColor.G > 0);
        Assert.Equal("Learn the potion recipe {0}.", snapshot.PotionRecipeDescription);
    }

    [Fact]
    public void IncludesGlobalTermSetsAndTermColorMatch()
    {
        var snapshot = MasterTooltipExtractor.Build(FakeMasterData.Sample, FakeMasterData.PotionRecipeDescription);
        Assert.NotEmpty(snapshot.GlobalTermSets);
        Assert.False(string.IsNullOrEmpty(snapshot.TermColorMatch));
    }
}
```

`FakeMasterData` is a hand-written test double matching the shape `MasterTooltipExtractor.Build` expects (a façade around `ArdenfallMasterData` fields that we can inject in tests). Add `FakeMasterData.cs` in the same test directory exposing two static fields: `Sample` (an instance with realistic values matching the schema) and `PotionRecipeDescription` (a string).

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --filter MasterTooltipExtractorTests`
Expected: FAIL — types do not exist.

- [ ] **Step 3: Implement the DTO**

```cs
// mod/src/MasterTooltip/MasterTooltipVocabularySnapshot.cs
using System.Collections.Generic;
using ArdenfallCompendium.Assets;
using Newtonsoft.Json;

namespace ArdenfallCompendium.MasterTooltip;

public sealed record MasterTooltipVocabularySnapshot(
    [property: JsonProperty("schemaVersion")] int SchemaVersion,
    [property: JsonProperty("tooltipCodes")] Dictionary<string, string> TooltipCodes,
    [property: JsonProperty("tooltipColors")] Dictionary<string, MasterTooltipColorTokenSnapshot> TooltipColors,
    [property: JsonProperty("tooltipTargetColor")] AssetColorSnapshot TooltipTargetColor,
    [property: JsonProperty("tooltipDurationColor")] AssetColorSnapshot TooltipDurationColor,
    [property: JsonProperty("positiveColor")] AssetColorSnapshot PositiveColor,
    [property: JsonProperty("negativeColor")] AssetColorSnapshot NegativeColor,
    [property: JsonProperty("spellSubEffectColor")] AssetColorSnapshot SpellSubEffectColor,
    [property: JsonProperty("enchantmentItemColor")] AssetColorSnapshot EnchantmentItemColor,
    [property: JsonProperty("primarySpellTooltip")] string PrimarySpellTooltip,
    [property: JsonProperty("secondarySpellTooltip")] string SecondarySpellTooltip,
    [property: JsonProperty("unmetSkillMessage")] string UnmetSkillMessage,
    [property: JsonProperty("brokenDurabilityMessage")] string BrokenDurabilityMessage,
    [property: JsonProperty("ruinedDurabilityMessage")] string RuinedDurabilityMessage,
    [property: JsonProperty("statBookMessage")] string StatBookMessage,
    [property: JsonProperty("termSetColors")] Dictionary<string, MasterTooltipColorTokenSnapshot> TermSetColors,
    [property: JsonProperty("globalTermSets")] List<MasterTooltipTermSetSnapshot> GlobalTermSets,
    [property: JsonProperty("termColorMatch")] string TermColorMatch,
    [property: JsonProperty("potionRecipeDescription")] string PotionRecipeDescription);

public sealed record MasterTooltipColorTokenSnapshot(
    [property: JsonProperty("color")] string Color,
    [property: JsonProperty("text")] string Text);

public sealed record MasterTooltipTermSetSnapshot(
    [property: JsonProperty("setId")] string SetId,
    [property: JsonProperty("terms")] List<string> Terms,
    [property: JsonProperty("regex")] string Regex,
    [property: JsonProperty("replacement")] string Replacement);
```

- [ ] **Step 4: Implement the extractor**

```cs
// mod/src/MasterTooltip/MasterTooltipExtractor.cs
using System.Collections.Generic;
using System.Linq;
using Ardenfall;
using ArdenfallCompendium.Assets;

namespace ArdenfallCompendium.MasterTooltip;

public static class MasterTooltipExtractor
{
    public static MasterTooltipVocabularySnapshot Build(ArdenfallMasterData master, string potionRecipeDescription)
    {
        return new MasterTooltipVocabularySnapshot(
            SchemaVersion: 2,
            TooltipCodes: master.tooltipCodes.ToDictionary(c => c.code, c => c.text),
            TooltipColors: master.tooltipColors.ToDictionary(
                c => c.code,
                c => new MasterTooltipColorTokenSnapshot("#" + UnityEngine.ColorUtility.ToHtmlStringRGB(c.color), c.text)),
            TooltipTargetColor: AssetColorSnapshot.FromColor(master.tooltipTargetColor),
            TooltipDurationColor: AssetColorSnapshot.FromColor(master.tooltipDurationColor),
            PositiveColor: AssetColorSnapshot.FromColor(master.positiveColor),
            NegativeColor: AssetColorSnapshot.FromColor(master.negativeColor),
            SpellSubEffectColor: AssetColorSnapshot.FromColor(master.spellSubEffectColor),
            EnchantmentItemColor: AssetColorSnapshot.FromColor(master.enchantmentItemColor),
            PrimarySpellTooltip: master.primarySpellTooltip ?? "",
            SecondarySpellTooltip: master.secondarySpellTooltip ?? "",
            UnmetSkillMessage: master.unmetSkillMessage ?? "",
            BrokenDurabilityMessage: master.brokenDurabilityMessage ?? "",
            RuinedDurabilityMessage: master.ruinedDurabilityMessage ?? "",
            StatBookMessage: master.statBookMessage ?? "",
            TermSetColors: master.termSetColors.ToDictionary(
                c => c.code,
                c => new MasterTooltipColorTokenSnapshot("#" + UnityEngine.ColorUtility.ToHtmlStringRGB(c.color), c.text)),
            GlobalTermSets: master.globalTermSets
                .Select((set, index) => new MasterTooltipTermSetSnapshot(
                    SetId: set.terms != null && set.terms.Count > 0
                        ? string.Join("-", set.terms.Take(2)).Replace(" ", "-").ToLowerInvariant() + (index > 0 ? "-" + index : "")
                        : "set-" + index,
                    Terms: set.terms ?? new List<string>(),
                    Regex: set.regex ?? "",
                    Replacement: set.replacement ?? ""))
                .ToList(),
            TermColorMatch: master.termColorMatch ?? "",
            PotionRecipeDescription: potionRecipeDescription ?? "");
    }
}
```

If the field names on `ArdenfallMasterData` differ from this draft, fix the references to match — confirm by reading `.decompiled/.../ArdenfallMasterData.cs` and `TermSetContainer.cs`. Do not invent fields.

- [ ] **Step 5: Wire into snapshot emission**

Locate where item snapshot artifacts are written (search for `WriteSnapshotEnvelope` or `items.json` emission in the mod). Add a parallel emission for `master-tooltip.json` invoking `MasterTooltipExtractor.Build(ArdenfallMasterData.Instance, WorldSingleton<PotionRecipeManager>.Instance?.potionRecipeDescription ?? "")`.

- [ ] **Step 6: Run mod tests**

Run: `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --filter MasterTooltipExtractorTests`
Expected: PASS.

- [ ] **Step 7: Run the full mod test suite**

Run: `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj`
Expected: PASS (no regressions).

- [ ] **Step 8: Commit**

```sh
git add mod/src/MasterTooltip/ mod-tests/MasterTooltipExtractorTests.cs mod-tests/FakeMasterData.cs
git commit -m "feat(mod): extract master tooltip vocabulary v2"
```

### Task 1.5: Phase 1 verification gate

- [ ] Run the standard phase gate (see "Verification gates" in pre-flight). Every command must exit 0.
- [ ] Confirm `bun run --cwd site smoke:item-icons` still passes (the site has not been touched but the existing presentation must keep rendering through the new tooltipColors shape).
- [ ] Confirm `git status --short` is clean apart from intentional new files.
- [ ] No commit at this step; gate failure means returning to a prior task.

---
