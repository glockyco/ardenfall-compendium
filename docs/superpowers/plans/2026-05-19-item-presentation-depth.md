# Item Presentation Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace generic item field-list pages with a generated item presentation, rich-text, relationship, and governed-component contract for Slice 4.

**Architecture:** The mod emits deterministic `item-presentation-v1` DTOs beside canonical item fields; the pipeline validates/translates them into `rich_text_v1`, `item_presentation_rows`, graph tables, relationship sections, and manifest diagnostics; the site reads those generated contracts through server-only accessors and renders typed Svelte components without raw HTML. This is a clean cutover: public item pages stop reading `item_detail_rows.fields_json`, and any inspection-only surface remains private diagnostics rather than a fallback route contract.

**Tech Stack:** BepInEx 5 / C# DTOs, xUnit mod tests, Bun pipeline stages, JSON Schema/AJV generated validators, SQLite read-model emission, SvelteKit 2 static prerendering, Svelte 5 components, Tailwind v4 token-backed styling, Bun tests and smoke scripts.

---

## Source-grounded constraints

- Active design: `docs/superpowers/specs/2026-05-19-item-presentation-depth-design.md`.
- Audits: `docs/superpowers/specs/2026-05-14-item-icon-tooltip-audit.md` and `docs/superpowers/specs/2026-05-15-tooltip-and-ui-surface-audit.md`.
- Root invariant: descriptors remain the cross-subsystem source for canonical entity shape; presentation/link contracts are generated pipeline data; public contract replacement is a clean cutover.
- Site invariant: route loaders read SQLite through `site/src/lib/server/read-models.ts`; Svelte components receive typed props and do not open SQLite, parse descriptors, parse raw TMP/HTML, or infer durable links.
- Mod invariant: presentation DTOs are deterministic, base-state-only, and never instantiate UI panels, fake player/inventory/merchant state, or hover side effects.
- Static-first invariant: item detail pages remain prerendered static HTML without hydration. `/items` may opt into CSR only for bounded URL-state filters/sorting while preserving its unfiltered prerendered table fallback.

## Files and responsibilities

- `mod/src/Entities/Item/ItemPresentationSnapshot.cs` — wire DTOs for `presentation`, stat rows, requirements, durability, state facts, omissions, and diagnostics.
- `mod/src/Entities/Item/ItemPresentationBuilder.cs` — deterministic builder over extracted item fields/provenance; no UI singleton or fake state access.
- `mod/src/Entities/Item/ItemSnapshot.cs` — add `presentation` to each row and bump item envelope schema version.
- `mod/src/Entities/Item/ItemExtractor.cs` — attach the presentation DTO after canonical field extraction.
- `mod-tests/ItemPresentationTests.cs` — DTO/builder tests for render context, stat rows, base state, and no fake comparison data.
- `schemas/snapshot.schema.json` — optional but strictly shaped `presentation` row property.
- `schemas/artifact-manifest.schema.json` — allow Slice 4 count keys and keep manifest validation strict.
- `pipeline/src/types.ts` — shared TypeScript types for presentation, rich text, relationship sections, and artifact counts.
- `pipeline/src/rich-text/rich-text-v1.ts` — safe TMP/game-string translator that returns typed nodes and diagnostics.
- `pipeline/src/relationships/relationship-graph.ts` — graph table DDL, node/alias/edge derivation, relationship section materialization, and link audit helpers.
- `pipeline/src/stages/validate.ts` — item-specific presentation validation and missing-presentation diagnostics.
- `pipeline/src/stages/emit-read-models.ts` — emit `item_overview_rows`, `item_presentation_rows`, graph tables, filter metadata, and relationship sections; remove `item_detail_rows` emission.
- `pipeline/src/stages/emit-sqlite.ts` — pass the item envelope into read-model emission and run graph audits before artifact finalization.
- `pipeline/src/artifacts/manifest.ts` — count `itemPresentationRows`, relationship graph rows, and presentation/link diagnostics.
- `pipeline/test/*.test.ts` — focused tests for schema validation, rich text, read models, graph integrity, manifest counts, and clean cutover.
- `fixtures/synthetic/snapshot/items.json` and `fixtures/synthetic/manifest.json` — fixture rows with presentation payloads covering plain/rich/diagnostic text, stats, requirements, state facts, and graph edges.
- `site/src/lib/server/read-models.ts` — typed accessors for item presentation, item IDs, relationship sections, graph link targets, and overview filter metadata; remove `getItemDetail`.
- `site/src/lib/components/COMPONENTS.json` — deterministic component catalog metadata for Slice 4 shared components.
- `site/src/lib/components/content/RichText.svelte` and `site/src/lib/components/content/RichTextNode.svelte` — typed rich-text renderer; no `{@html}`.
- `site/src/lib/components/items/*` — item icon/header/stat/requirements/effects/state/panel/tooltip/filter components.
- `site/src/lib/components/relationships/*` — entity link, related card, and relationship section components.
- `site/src/lib/components/items/item-overview-filter-state.ts` — pure URL parsing/canonicalization/filter/sort helpers.
- `site/src/routes/items/+page.server.ts`, `site/src/routes/items/+page.ts`, `site/src/routes/items/+page.svelte` — static overview fallback plus bounded CSR URL-state enhancement.
- `site/src/routes/items/[id]/+page.server.ts`, `site/src/routes/items/[id]/+page.svelte` — item presentation route assembly only.
- `site/scripts/smoke-prerender-output.mjs` — assert prerendered item presentation HTML and no detail hydration regression.
- `tooling.test.ts` — guardrails for component catalog, no raw `{@html}` in item presentation path, and clean removal of `fields_json` public plumbing.
- `docs/superpowers/roadmap.md` — mark Slice 4 plan/in-progress/done state as the implementation advances.

---

### Task 1: Add mod presentation DTOs and deterministic builder

**Files:**

- Create: `mod/src/Entities/Item/ItemPresentationSnapshot.cs`
- Create: `mod/src/Entities/Item/ItemPresentationBuilder.cs`
- Modify: `mod/src/Entities/Item/ItemSnapshot.cs`
- Modify: `mod/src/Entities/Item/ItemExtractor.cs`
- Test: `mod-tests/ItemPresentationTests.cs`

- [ ] **Step 1: Write failing DTO and builder tests**

Create `mod-tests/ItemPresentationTests.cs`:

```csharp
using System.Collections.Generic;
using ArdenfallCompendium.Entities.Item;
using ArdenfallCompendium.Dtos;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class ItemPresentationTests
{
    [Fact]
    public void BuilderUsesDeterministicBaseRenderContext()
    {
        var fields = new Dictionary<string, object?>
        {
            ["name"] = "Iron Sword",
            ["description"] = "A simple iron blade.",
            ["value"] = 25,
            ["weight"] = 3.5f,
            ["damage"] = 7.5f,
            ["meleeDurabilityMax"] = 100,
        };
        var provenance = new Dictionary<string, Provenance>
        {
            ["name"] = new()
            {
                Kind = "parameter",
                Source = "GetItemName()",
                IsSet = true,
                Inherited = false,
            },
        };

        var presentation = ItemPresentationBuilder.FromExtractedFields(
            rowId: "fixture-iron-sword",
            variantId: "melee-weapon",
            fields,
            provenance);

        Assert.Equal(1, presentation.SchemaVersion);
        Assert.Equal("item-presentation-v1", presentation.RenderContext);
        Assert.Equal("Iron Sword", presentation.DisplayName);
        Assert.Equal("GetItemName()", presentation.DisplayNameSourceMethod);
        Assert.Equal("Melee weapon", presentation.ItemType);
        Assert.Equal("variant:melee-weapon", presentation.ItemTypeSourceMethod);
        Assert.Equal("A simple iron blade.", presentation.DescriptionSource);
        Assert.Equal(25, presentation.Value);
        Assert.Equal(3.5f, presentation.Weight);
        Assert.Contains(presentation.StatRows, row =>
            row.Id == "damage" && row.Label == "Damage" && row.ValueText == "7.5" && row.Comparison == null);
        Assert.Equal("max-durability", presentation.Durability?.Kind);
        Assert.Equal(100, presentation.Durability?.Max);
        Assert.Contains(presentation.StateFacts, fact => fact.Kind == "canonical-state");
        Assert.Contains(presentation.Omissions, omission => omission.Code == "equippedComparisonOmitted");
    }

    [Fact]
    public void BuilderDoesNotSynthesizePlayerInventoryOrMerchantState()
    {
        var fields = new Dictionary<string, object?>
        {
            ["name"] = "Stamina Draught",
            ["description"] = "Drink to restore stamina.",
            ["quickslotCooldownTime"] = 12.5f,
            ["stackable"] = true,
        };

        var presentation = ItemPresentationBuilder.FromExtractedFields(
            rowId: "fixture-stamina-draught",
            variantId: "consumable",
            fields,
            provenance: new Dictionary<string, Provenance>());

        Assert.All(presentation.StatRows, row => Assert.Null(row.Comparison));
        Assert.DoesNotContain(presentation.StateFacts, fact => fact.Kind.Contains("merchant"));
        Assert.DoesNotContain(presentation.StateFacts, fact => fact.Kind.Contains("inventory"));
        Assert.Contains(presentation.StateFacts, fact =>
            fact.Kind == "stacking" && fact.Label == "Stackable");
    }
}
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```sh
dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --filter ItemPresentationTests
```

Expected: fail because `ItemPresentationBuilder` and presentation DTO classes do not exist.

- [ ] **Step 3: Add presentation DTOs**

Create `mod/src/Entities/Item/ItemPresentationSnapshot.cs` with these public wire shapes:

```csharp
using System.Collections.Generic;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.Item;

public sealed class ItemPresentationSnapshot
{
    [JsonProperty("schemaVersion")] public int SchemaVersion { get; init; } = 1;
    [JsonProperty("renderContext")] public string RenderContext { get; init; } = "item-presentation-v1";
    [JsonProperty("displayName")] public string DisplayName { get; init; } = "";
    [JsonProperty("displayNameSourceMethod")] public string DisplayNameSourceMethod { get; init; } = "unknown";
    [JsonProperty("itemType")] public string? ItemType { get; init; }
    [JsonProperty("itemTypeSourceMethod")] public string? ItemTypeSourceMethod { get; init; }
    [JsonProperty("descriptionSource")] public string DescriptionSource { get; init; } = "";
    [JsonProperty("effectsSource")] public string EffectsSource { get; init; } = "";
    [JsonProperty("effects")] public List<ItemPresentationEffectSnapshot> Effects { get; init; } = new();
    [JsonProperty("statRows")] public List<ItemPresentationStatRowSnapshot> StatRows { get; init; } = new();
    [JsonProperty("requirements")] public List<ItemPresentationRequirementSnapshot> Requirements { get; init; } = new();
    [JsonProperty("durability")] public ItemPresentationDurabilitySnapshot? Durability { get; init; }
    [JsonProperty("stateFacts")] public List<ItemPresentationStateFactSnapshot> StateFacts { get; init; } = new();
    [JsonProperty("omissions")] public List<ItemPresentationOmissionSnapshot> Omissions { get; init; } = new();
    [JsonProperty("value")] public int? Value { get; init; }
    [JsonProperty("weight")] public float? Weight { get; init; }
    [JsonProperty("diagnostics")] public List<ItemPresentationDiagnosticSnapshot> Diagnostics { get; init; } = new();
}

public sealed class ItemPresentationStatRowSnapshot
{
    [JsonProperty("id")] public string Id { get; init; } = "";
    [JsonProperty("label")] public string Label { get; init; } = "";
    [JsonProperty("value")] public float? Value { get; init; }
    [JsonProperty("valueText")] public string ValueText { get; init; } = "";
    [JsonProperty("suffix")] public string? Suffix { get; init; }
    [JsonProperty("size")] public string Size { get; init; } = "normal";
    [JsonProperty("indent")] public int Indent { get; init; }
    [JsonProperty("comparison")] public string? Comparison { get; init; }
    [JsonProperty("source")] public string Source { get; init; } = "";
}

public sealed class ItemPresentationRequirementSnapshot
{
    [JsonProperty("id")] public string Id { get; init; } = "";
    [JsonProperty("label")] public string Label { get; init; } = "";
    [JsonProperty("valueText")] public string ValueText { get; init; } = "";
    [JsonProperty("source")] public string Source { get; init; } = "";
}

public sealed class ItemPresentationDurabilitySnapshot
{
    [JsonProperty("kind")] public string Kind { get; init; } = "max-durability";
    [JsonProperty("max")] public float Max { get; init; }
    [JsonProperty("source")] public string Source { get; init; } = "";
}

public sealed class ItemPresentationEffectSnapshot
{
    [JsonProperty("kind")] public string Kind { get; init; } = "";
    [JsonProperty("label")] public string Label { get; init; } = "";
    [JsonProperty("targetType")] public string? TargetType { get; init; }
    [JsonProperty("targetId")] public string? TargetId { get; init; }
    [JsonProperty("source")] public string Source { get; init; } = "";
}

public sealed class ItemPresentationStateFactSnapshot
{
    [JsonProperty("kind")] public string Kind { get; init; } = "";
    [JsonProperty("label")] public string Label { get; init; } = "";
    [JsonProperty("description")] public string Description { get; init; } = "";
}

public sealed class ItemPresentationOmissionSnapshot
{
    [JsonProperty("code")] public string Code { get; init; } = "";
    [JsonProperty("severity")] public string Severity { get; init; } = "diagnostic";
    [JsonProperty("message")] public string Message { get; init; } = "";
}

public sealed class ItemPresentationDiagnosticSnapshot
{
    [JsonProperty("severity")] public string Severity { get; init; } = "diagnostic";
    [JsonProperty("code")] public string Code { get; init; } = "";
    [JsonProperty("field")] public string Field { get; init; } = "presentation";
    [JsonProperty("message")] public string Message { get; init; } = "";
}
```

- [ ] **Step 4: Implement the deterministic builder**

Create `mod/src/Entities/Item/ItemPresentationBuilder.cs`. It must operate on already-extracted fields/provenance; it must not call UI classes, inventory APIs, merchant APIs, or hover tooltip APIs.

Key helpers to include:

```csharp
private static readonly (string Field, string Label, string Source, string Size)[] StatFields =
{
    ("damage", "Damage", "MeleeItem.GetItemStatInfos()", "large"),
    ("armorRating", "Armor", "ArmorItem.GetItemStatInfos()", "large"),
    ("quickslotCooldownTime", "Cooldown", "ConsumableItem.quickslotCooldownTime.Get()", "normal"),
    ("manaCostMultiplier", "Mana cost multiplier", "SlateSpellItem.manaCostMultiplier.Get()", "normal"),
};

public static ItemPresentationSnapshot FromExtractedFields(
    string rowId,
    string variantId,
    IReadOnlyDictionary<string, object?> fields,
    IReadOnlyDictionary<string, Provenance> provenance)
```

Behavior:

- `DisplayName` comes from `fields["name"]` or `rowId` if missing.
- `DisplayNameSourceMethod` comes from `provenance["name"].Source` or `fields.name` if missing.
- `ItemType` is `fields["itemTypeTooltip"]` when present, otherwise a title-cased variant (`melee-weapon` → `Melee weapon`).
- `DescriptionSource` comes from `fields["description"] ?? ""`.
- `EffectsSource` uses safe extracted fields only: status-effect arrays emit a short source string such as `Applies status effects`, slate spell fields emit `Casts ` plus the extracted spell name, throwing potion `effectName` emits `Effect: ` plus the extracted effect name, and missing optional targets emit effect diagnostics instead of fake resolved entities.
- `Effects` includes typed status/spell/enchantment facts or unresolved-reference diagnostics derived from existing extracted fields; it never calls player, inventory, UI, or hover systems.
- `Value`/`Weight` copy scalar values when present.
- `StatRows` includes known numeric stat fields only, with `Comparison = null`.
- `Durability` uses the first present field among `meleeDurabilityMax`, `armorDurabilityMax`, or `durabilityMax`.
- `StateFacts` always includes canonical base-state copy and may add stackable / throwing potion drink-or-throw facts from stable fields.
- `Omissions` includes `equippedComparisonOmitted` for equipment/hand/weapon/armor variants; it does not add merchant/inventory/current-durability fake values.

- [ ] **Step 5: Attach presentation to item snapshot rows**

Modify `mod/src/Entities/Item/ItemSnapshot.cs`:

```csharp
[JsonProperty("presentation")] public ItemPresentationSnapshot Presentation { get; init; } = new();
```

Update the summary comment to include `presentation`, and bump `ItemSnapshotEnvelope.SchemaVersion` to `2`.

Modify `mod/src/Entities/Item/ItemExtractor.cs` before yielding the row:

```csharp
var presentation = ItemPresentationBuilder.FromExtractedFields(guid, variantId, fields, provenance);
```

Then set `Presentation = presentation` in the `ItemSnapshotRow` initializer.

- [ ] **Step 6: Run tests to verify GREEN**

Run:

```sh
dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --filter ItemPresentationTests
```

Expected: pass.

- [ ] **Step 7: Commit mod presentation DTOs**

Run:

```sh
git add mod/src/Entities/Item/ItemPresentationSnapshot.cs mod/src/Entities/Item/ItemPresentationBuilder.cs mod/src/Entities/Item/ItemSnapshot.cs mod/src/Entities/Item/ItemExtractor.cs mod-tests/ItemPresentationTests.cs
git commit -m "feat(mod): emit item presentation snapshots"
```

---

### Task 2: Validate item presentation payloads and expand fixtures

**Files:**

- Modify: `schemas/snapshot.schema.json`
- Modify: `pipeline/src/types.ts`
- Modify: `pipeline/src/stages/validate.ts`
- Modify: `fixtures/synthetic/snapshot/items.json`
- Modify: `fixtures/synthetic/snapshot/master-tooltip.json`
- Modify: `fixtures/synthetic/manifest.json` (fixture pack hash manifest, not the snapshot runtime manifest)

- Test: `pipeline/test/snapshot.test.ts`

- [ ] **Step 1: Write failing validation tests**

Extend `pipeline/test/snapshot.test.ts` with:

```ts
it("requires every item row to carry item-presentation-v1", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ardenfall-missing-presentation-"));
  try {
    writeFileSync(
      join(dir, "manifest.json"),
      readFileSync("fixtures/synthetic/snapshot/manifest.json", "utf8"),
    );
    const items = JSON.parse(readFileSync("fixtures/synthetic/snapshot/items.json", "utf8")) as {
      rows: { presentation?: unknown }[];
    };
    delete items.rows[0].presentation;
    writeFileSync(join(dir, "items.json"), `${JSON.stringify(items, null, 2)}\n`);

    const snap = await loadSnapshot.run({}, { ...ctx, snapshotDir: dir });
    const desc = await loadDescriptors.run({}, ctx);
    const result = await validate.run({ "load-snapshot": snap, "load-descriptors": desc }, ctx);

    expect(result.countsBySeverity.fatal).toBeGreaterThan(0);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        entity: "item",
        row: "fixture-iron-sword",
        field: "presentation",
        code: "missingItemPresentation",
      }),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it("loads synthetic item presentations with schema version 2", async () => {
  const snap = await loadSnapshot.run({}, ctx);
  const items = snap.envelopes.item;
  if (!items) throw new Error("item envelope not loaded");

  expect(items.schemaVersion).toBe(2);
  expect(
    items.rows.every((row) => row.presentation?.renderContext === "item-presentation-v1"),
  ).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```sh
bun test pipeline/test/snapshot.test.ts
```

Expected: fail because `SnapshotRow` has no typed `presentation`, fixtures are still schema version 1, and validation does not enforce item presentation.

- [ ] **Step 3: Add TypeScript presentation types**

In `pipeline/src/types.ts`, extend `SnapshotRow`:

```ts
presentation?: ItemPresentationSnapshot;
```

Add exported interfaces matching the C# DTO names:

```ts
export interface ItemPresentationSnapshot {
  schemaVersion: 1;
  renderContext: "item-presentation-v1";
  displayName: string;
  displayNameSourceMethod: string;
  itemType: string | null;
  itemTypeSourceMethod: string | null;
  descriptionSource: string;
  effectsSource: string;
  effects: ItemPresentationEffect[];
  statRows: ItemPresentationStatRow[];
  requirements: ItemPresentationRequirement[];
  durability: ItemPresentationDurability | null;
  stateFacts: ItemPresentationStateFact[];
  omissions: ItemPresentationOmission[];
  value: number | null;
  weight: number | null;
  diagnostics: ItemPresentationDiagnostic[];
}
```

Define the child interfaces with the same property names from Task 1.

- [ ] **Step 4: Tighten snapshot schema for optional `presentation`**

Modify `schemas/snapshot.schema.json` row `properties` to include:

```json
"presentation": { "$ref": "#/$defs/itemPresentation" }
```

Add `$defs.itemPresentation` with `additionalProperties: false`, required properties matching the DTO contract, `renderContext.const = "item-presentation-v1"`, and typed arrays for `statRows`, `requirements`, `stateFacts`, `omissions`, and `diagnostics`.

Do not make `presentation` globally required in JSON Schema; non-item future envelopes may not use item presentation. Item-specific enforcement belongs in `validate.ts`.

- [ ] **Step 5: Enforce item presentation in validation**

In `pipeline/src/stages/validate.ts`, inside the per-row loop, add item-only checks:

```ts
if (entityId === "item") {
  if (!row.presentation) {
    errors.push({
      entity: entityId,
      row: row.id,
      field: "presentation",
      code: "missingItemPresentation",
      message: `public item '${row.id}' is missing item-presentation-v1`,
    });
    fatal++;
  } else if (row.presentation.renderContext !== "item-presentation-v1") {
    errors.push({
      entity: entityId,
      row: row.id,
      field: "presentation.renderContext",
      code: "invalidItemPresentationContext",
      message: `public item '${row.id}' uses unsupported presentation context '${row.presentation.renderContext}'`,
    });
    fatal++;
  }
}
```

- [ ] **Step 6: Expand synthetic fixture presentations**

Modify `fixtures/synthetic/snapshot/items.json`:

- set top-level `schemaVersion` to `2`;
- add `presentation` to every row;
- ensure fixture coverage:
  - `fixture-iron-sword`: plain description, damage stat, durability, Strength requirement, canonical-state omission;
  - `fixture-leather-tunic`: empty description, armor stat, durability;
  - `fixture-stamina-draught`: `<b>`, `<color=#7CFF8A>`, and `<link="tooltip_stamina">Stamina</link>` description coverage, plus status reference diagnostic through effects source;
  - `fixture-slate-spell`: spell reference source text;
  - `fixture-throwing-potion`: unknown rich-text tag diagnostic case and drink/throw state fact.
- add `fixtures/synthetic/snapshot/master-tooltip.json` with `tooltipCodes: { "stamina": "Stamina" }` and `tooltipColors: { "p": "positive", "n": "negative" }`;

Use this shape for `fixture-iron-sword`:

```json
"presentation": {
  "schemaVersion": 1,
  "renderContext": "item-presentation-v1",
  "displayName": "Iron Sword",
  "displayNameSourceMethod": "GetItemName()",
  "itemType": "Melee weapon",
  "itemTypeSourceMethod": "variant:melee-weapon",
  "descriptionSource": "A simple iron blade.",
  "effectsSource": "",
  "effects": [],
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
  "requirements": [
    {
      "id": "strength",
      "label": "Strength",
      "valueText": "5",
      "source": "EquipItem.GetMinimumStat()"
    }
  ],
  "durability": { "kind": "max-durability", "max": 100, "source": "meleeDurabilityMax" },
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
  ],
  "value": 25,
  "weight": 3.5,
  "diagnostics": []
}
```

- [ ] **Step 7: Regenerate validators and update fixture hashes**

Run:

```sh
bun run codegen:validators
bun run check:fixtures
```

Expected: `codegen:validators` rewrites `pipeline/dist/validate-snapshot.mjs`; `check:fixtures` fails once with a hash mismatch for `snapshot/items.json`.

Update `fixtures/synthetic/manifest.json.hashes["snapshot/items.json"]` to the SHA-256 of the rewritten `items.json`, then run:

```sh
bun run check:fixtures
```

Expected: `fixtures ok: ... bytes total`.

- [ ] **Step 8: Run tests to verify GREEN**

Run:

```sh
bun test pipeline/test/snapshot.test.ts
```

Expected: pass.

- [ ] **Step 9: Commit validation and fixture contract**

Run:

```sh
git add schemas/snapshot.schema.json pipeline/dist/validate-snapshot.mjs pipeline/dist/validate-snapshot.d.mts pipeline/src/types.ts pipeline/src/stages/validate.ts pipeline/test/snapshot.test.ts fixtures/synthetic/snapshot/items.json fixtures/synthetic/snapshot/master-tooltip.json fixtures/synthetic/manifest.json
git commit -m "feat(pipeline): validate item presentation snapshots"
```

---

### Task 3: Add safe `rich_text_v1` translation

**Files:**

- Create: `pipeline/src/rich-text/rich-text-v1.ts`
- Test: `pipeline/test/rich-text-v1.test.ts`

- [ ] **Step 1: Write failing rich-text translator tests**

Create `pipeline/test/rich-text-v1.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { translateRichTextV1 } from "$pipeline/rich-text/rich-text-v1";

const textNodes = (nodes: { type: string; text?: string }[]) =>
  nodes.filter((node) => node.type === "text").map((node) => node.text);

describe("translateRichTextV1", () => {
  it("translates plain text and line breaks into typed nodes", () => {
    const rich = translateRichTextV1("Line one\nLine two");

    expect(rich.schemaVersion).toBe(1);
    expect(rich.nodes).toEqual([
      { type: "text", text: "Line one" },
      { type: "lineBreak" },
      { type: "text", text: "Line two" },
    ]);
    expect(rich.diagnostics).toEqual([]);
  });

  it("translates supported TMP formatting without emitting HTML", () => {
    const rich = translateRichTextV1("A <b>sharp</b> <color=#7CFF8A>blade</color>");

    expect(rich.nodes).toEqual([
      { type: "text", text: "A " },
      { type: "strong", children: [{ type: "text", text: "sharp" }] },
      { type: "text", text: " " },
      {
        type: "color",
        token: null,
        color: "#7CFF8A",
        children: [{ type: "text", text: "blade" }],
      },
    ]);
    expect(JSON.stringify(rich.nodes)).not.toContain("<strong>");
  });

  it("keeps unknown tags as escaped text plus diagnostics", () => {
    const rich = translateRichTextV1("A <shake>volatile</shake> flask");

    expect(textNodes(rich.nodes)).toContain("<shake>");
    expect(textNodes(rich.nodes)).toContain("</shake>");
    expect(rich.diagnostics).toContainEqual(
      expect.objectContaining({ code: "unsupportedRichTextTag", severity: "diagnostic" }),
    );
  });

  it("translates tooltip links to term links", () => {
    const rich = translateRichTextV1('<link="tooltip_stamina">Stamina</link>');

    expect(rich.nodes).toEqual([{ type: "termLink", termId: "stamina", label: "Stamina" }]);
  });

  it("expands known tooltip color/code dictionaries and diagnoses unknown keys", () => {
    const rich = translateRichTextV1("[p +10] {stamina}", {
      tooltipColors: { p: "positive" },
      tooltipCodes: { stamina: "Stamina" },
    });

    expect(rich.nodes).toContainEqual(
      expect.objectContaining({
        type: "color",
        token: "positive",
        color: null,
      }),
    );
    expect(JSON.stringify(rich.nodes)).toContain("Stamina");
    expect(translateRichTextV1("{missing_code}").diagnostics).toContainEqual(
      expect.objectContaining({ code: "unresolvedTooltipCode", severity: "diagnostic" }),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```sh
bun test pipeline/test/rich-text-v1.test.ts
```

Expected: fail because `pipeline/src/rich-text/rich-text-v1.ts` does not exist.

- [ ] **Step 3: Implement the translator**

Create `pipeline/src/rich-text/rich-text-v1.ts` exporting:

```ts
export type RichTextV1 = {
  schemaVersion: 1;
  sourceHash: string;
  nodes: RichTextNode[];
  diagnostics: RichTextDiagnostic[];
};

export type RichTextNode =
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

Implementation requirements:

- compute `sourceHash` with SHA-256 over the source string;
- parse line breaks into `{ type: "lineBreak" }`;
- support `<b>`, `<i>`, `<s>`, `<color=#RRGGBB>`, `<color=#RRGGBBAA>`, `[p ...]`/`[n ...]` style tooltip color prefixes from exported `tooltipColors`, `{code}` tooltip replacements from exported `tooltipCodes`, `<link="tooltip_x">label</link>`, and `<sprite name="x">`;
- reject invalid colors with a `rejectedColorValue` diagnostic and preserve the tag as text;
- add `unresolvedTooltipCode` and `unresolvedTooltipColor` diagnostics for missing master-data keys;
- preserve unknown tags as text nodes and add `unsupportedRichTextTag` diagnostics;
- never return HTML strings.

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```sh
bun test pipeline/test/rich-text-v1.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit rich-text translator**

Run:

```sh
git add pipeline/src/rich-text/rich-text-v1.ts pipeline/test/rich-text-v1.test.ts
git commit -m "feat(pipeline): translate item rich text"
```

---

### Task 4: Emit `item_presentation_rows` and remove item detail fallback

**Files:**

- Modify: `pipeline/src/stages/emit-read-models.ts`
- Modify: `pipeline/src/stages/emit-sqlite.ts`
- Modify: `pipeline/test/read-models.test.ts`
- Modify: `pipeline/test/end-to-end.test.ts`

- [ ] **Step 1: Rewrite read-model tests for clean cutover**

Update `pipeline/test/read-models.test.ts` so the main test name is:

```ts
it("builds item_overview_rows and item_presentation_rows without item_detail_rows", async () => {
```

Update the test to call:

```ts
emitItemReadModels(db, desc, itemEnvelope, iconMetadata);
```

Replace all `item_detail_rows` assertions with:

```ts
const presentation = db
  .query(
    `SELECT item_id, render_context, display_name, display_name_source_method,
            description_rich_text_json, effects_rich_text_json, effect_facts_json,
            stat_rows_json, requirements_json, durability_json, state_facts_json,
            omissions_json, display_icon_hash, display_icon_color
       FROM item_presentation_rows
      WHERE item_id = 'fixture-iron-sword'`,
  )
  .get() as {
  item_id: string;
  render_context: string;
  display_name: string;
  display_name_source_method: string;
  description_rich_text_json: string;
  effects_rich_text_json: string;
  effect_facts_json: string;
  stat_rows_json: string;
  requirements_json: string;
  durability_json: string | null;
  state_facts_json: string;
  omissions_json: string;
  display_icon_hash: string | null;
  display_icon_color: string | null;
};

expect(presentation.render_context).toBe("item-presentation-v1");
expect(presentation.display_name).toBe("Iron Sword");
expect(presentation.display_name_source_method).toBe("GetItemName()");
expect(JSON.parse(presentation.description_rich_text_json)).toEqual(
  expect.objectContaining({ schemaVersion: 1 }),
);
expect(JSON.parse(presentation.effect_facts_json)).toEqual([]);
expect(JSON.parse(presentation.stat_rows_json)).toContainEqual(
  expect.objectContaining({ id: "damage", comparison: null }),
);
expect(JSON.parse(presentation.requirements_json)).toContainEqual(
  expect.objectContaining({ id: "strength", label: "Strength" }),
);
expect(JSON.parse(presentation.state_facts_json)).toContainEqual(
  expect.objectContaining({ kind: "canonical-state" }),
);
expect(JSON.parse(presentation.omissions_json)).toContainEqual(
  expect.objectContaining({ code: "equippedComparisonOmitted" }),
);
expect(presentation.display_icon_hash).toBe("a".repeat(64));

const linkedDescription = db
  .query(
    "SELECT description_rich_text_json FROM item_presentation_rows WHERE item_id = 'fixture-stamina-draught'",
  )
  .get() as { description_rich_text_json: string };
expect(JSON.parse(linkedDescription.description_rich_text_json).nodes).toContainEqual(
  expect.objectContaining({
    type: "termLink",
    termId: "stamina",
    label: "Stamina",
  }),
);

const legacy = db
  .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'item_detail_rows'")
  .get();
expect(legacy).toBeUndefined();
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```sh
bun test pipeline/test/read-models.test.ts
```

Expected: fail because the read-model stage still emits `item_detail_rows` and has no `item_presentation_rows`.

- [ ] **Step 3: Implement `item_presentation_rows` DDL and inserts**

In `pipeline/src/stages/emit-read-models.ts`:

- remove `CREATE TABLE item_detail_rows` from `ITEM_READ_MODEL_DDL`;
- add the `item_presentation_rows` DDL from the design spec, plus `effect_facts_json TEXT NOT NULL` because Slice 4 renders typed effect facts rather than only effect prose;
- import `translateRichTextV1` and `loadMasterTooltipDictionary`;
- change `emitItemReadModels` signature to:

```ts
export function emitItemReadModels(
  db: Database,
  desc: LoadDescriptorsOutput,
  itemEnvelope: SnapshotEnvelope,
  itemIconMetadata: SnapshotItemIconMetadata[] = [],
): void;
```

- make `item_overview_rows.name` use `row.presentation?.displayName ?? row.name` by building a `presentationById` map;
- insert one `item_presentation_rows` row per item presentation;
- serialize parsed/translated JSON once in the pipeline:

```ts
const tooltipDictionary = loadMasterTooltipDictionary(itemEnvelope);
description_rich_text_json = JSON.stringify(
  translateRichTextV1(presentation.descriptionSource, tooltipDictionary),
);
effects_rich_text_json = JSON.stringify(
  translateRichTextV1(presentation.effectsSource, tooltipDictionary),
);
stat_rows_json = JSON.stringify(presentation.statRows);
effect_facts_json = JSON.stringify(presentation.effects);
requirements_json = JSON.stringify(presentation.requirements);
durability_json = presentation.durability ? JSON.stringify(presentation.durability) : null;
state_facts_json = JSON.stringify(presentation.stateFacts);
omissions_json = JSON.stringify(presentation.omissions);
diagnostics_json = JSON.stringify([
  ...presentation.diagnostics,
  ...translateRichTextV1(presentation.descriptionSource, tooltipDictionary).diagnostics,
  ...translateRichTextV1(presentation.effectsSource, tooltipDictionary).diagnostics,
]);
```

Compute each translation once per row and reuse it; do not translate the same string repeatedly.

- [ ] **Step 4: Update SQLite stage callsite**

In `pipeline/src/stages/emit-sqlite.ts`, change:

```ts
emitItemReadModels(db, desc, inputs["emit-assets"]?.itemIconMetadata ?? []);
```

to:

```ts
emitItemReadModels(db, desc, itemEnvelope, inputs["emit-assets"]?.itemIconMetadata ?? []);
```

- [ ] **Step 5: Remove legacy detail-field aggregation code**

Delete the `fields_json` aggregation loop, `DescriptorField` type, `assignFields`, `ancestry`, `insertDetail`, and `displayIconByItem` logic that only existed for `item_detail_rows`.

- [ ] **Step 6: Run tests to verify GREEN**

Run:

```sh
bun test pipeline/test/read-models.test.ts pipeline/test/end-to-end.test.ts
```

Expected: pass, and no emitted SQLite table named `item_detail_rows`.

- [ ] **Step 7: Commit presentation read model cutover**

Run:

```sh
git add pipeline/src/stages/emit-read-models.ts pipeline/src/stages/emit-sqlite.ts pipeline/test/read-models.test.ts pipeline/test/end-to-end.test.ts
git commit -m "feat(pipeline): emit item presentation read model"
```

---

### Task 5: Add generated relationship graph, link audit, and rich-text link resolution

**Files:**

- Create: `pipeline/src/relationships/relationship-graph.ts`
- Modify: `pipeline/src/rich-text/rich-text-v1.ts`
- Modify: `pipeline/src/stages/emit-read-models.ts`
- Test: `pipeline/test/relationship-graph.test.ts`
- Test: `pipeline/test/rich-text-v1.test.ts`
- Test: `pipeline/test/read-models.test.ts`

- [ ] **Step 1: Write failing graph and link-resolution tests**

Create `pipeline/test/relationship-graph.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import {
  ENTITY_GRAPH_DDL,
  auditEntityGraph,
  insertDisambiguationForDuplicateAliases,
} from "$pipeline/relationships/relationship-graph";

describe("relationship graph", () => {
  it("audits missing public edge targets", () => {
    const db = new Database(":memory:");
    db.exec(ENTITY_GRAPH_DDL);
    db.run(
      "INSERT INTO entity_nodes (entity_type, entity_id, label, route_path, canonical_slug, is_public) VALUES (?, ?, ?, ?, ?, ?)",
      "item",
      "source",
      "Source",
      "/items/source",
      "source",
      1,
    );
    db.run(
      "INSERT INTO entity_edges (edge_id, source_type, source_id, target_type, target_id, predicate, label, weight, evidence_json, anchor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      "edge-1",
      "item",
      "source",
      "item",
      "missing",
      "variant_of",
      "Variant of",
      1,
      "{}",
      null,
    );

    expect(auditEntityGraph(db)).toContainEqual(
      expect.objectContaining({ code: "relationshipMissingTarget", severity: "fatal" }),
    );
  });

  it("turns duplicate aliases into disambiguation records instead of ambiguous aliases", () => {
    const options = insertDisambiguationForDuplicateAliases("iron", [
      { targetType: "item", targetId: "iron-sword", label: "Iron Sword" },
      { targetType: "item", targetId: "iron-ore", label: "Iron Ore" },
    ]);

    expect(options.termKey).toBe("iron");
    expect(JSON.parse(options.optionsJson)).toEqual([
      { targetType: "item", targetId: "iron-sword", label: "Iron Sword" },
      { targetType: "item", targetId: "iron-ore", label: "Iron Ore" },
    ]);
  });
});
```

Extend `pipeline/test/rich-text-v1.test.ts` with a resolver case:

```ts
it("resolves term links through the generated graph contract when a resolver is supplied", () => {
  const rich = translateRichTextV1('<link="tooltip_stamina">Stamina</link>', {
    resolveTerm: (termId, label) => ({
      termId,
      label,
      targetType: "term",
      targetId: termId,
      targetLabel: label,
      targetRoutePath: "/terms/stamina",
      targetIsPublic: true,
    }),
  });

  expect(rich.nodes).toEqual([
    {
      type: "termLink",
      termId: "stamina",
      label: "Stamina",
      targetType: "term",
      targetId: "stamina",
      targetLabel: "Stamina",
      targetRoutePath: "/terms/stamina",
      targetIsPublic: true,
    },
  ]);
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```sh
bun test pipeline/test/relationship-graph.test.ts pipeline/test/rich-text-v1.test.ts
```

Expected: fail because `relationship-graph.ts` does not exist and `translateRichTextV1` does not accept a resolver.

- [ ] **Step 3: Implement graph DDL, alias helpers, audits, diagnostics, and section map**

Create `pipeline/src/relationships/relationship-graph.ts` exporting:

- `ENTITY_GRAPH_DDL` with `entity_nodes`, `entity_aliases`, `entity_redirects`, `entity_disambiguations`, `entity_edges`, `entity_relationship_sections`, and `pipeline_diagnostics`;
- `normaliseAliasKey(label: string): string` lowercasing, trimming, collapsing whitespace, and replacing non-alphanumeric runs with `-`;
- `insertDisambiguationForDuplicateAliases(termKey, options)` returning `{ termKey, label, optionsJson }`;
- `auditEntityGraph(db)` returning diagnostics for:
  - edge source missing;
  - edge target missing;
  - redirect target missing;
  - double redirect;
  - alias target missing;
  - unstable section anchor containing anything outside `[a-z0-9-]`;
- `insertPipelineDiagnostic(db, diagnostic)` and `insertPipelineDiagnostics(db, diagnostics, source)` helpers that write rows into `pipeline_diagnostics` with `severity`, `code`, `source`, `entity_type`, `entity_id`, `field`, and `message`;
- `sectionForPredicate(predicate)` mapping:
  - `requires_stat` → `requires` / `Requires`;
  - `applies_status` → `applies` / `Applies`;
  - `casts_spell` → `casts` / `Casts`;
  - `references_term` → `related-mechanics` / `Related mechanics`.

`pipeline_diagnostics` shape:

```sql
CREATE TABLE pipeline_diagnostics (
  diagnostic_id TEXT PRIMARY KEY,
  severity      TEXT NOT NULL,
  code          TEXT NOT NULL,
  source        TEXT NOT NULL,
  entity_type   TEXT,
  entity_id     TEXT,
  field         TEXT,
  message       TEXT NOT NULL
);
```

- [ ] **Step 4: Resolve rich-text links through generated graph data**

Update `pipeline/src/rich-text/rich-text-v1.ts` so `translateRichTextV1(source, resolver?)` accepts:

```ts
export type RichTextLinkResolver = {
  resolveTerm?: (termId: string, label: string) => RichTextTermLinkResolution | null;
  resolveEntity?: (
    targetType: string,
    targetId: string,
    label: string,
  ) => RichTextEntityLinkResolution | null;
};
```

Extend `termLink` and `entityLink` node types with optional resolved target fields:

```ts
targetType?: string;
targetId?: string;
targetLabel?: string;
targetRoutePath?: string | null;
targetIsPublic?: boolean;
```

If a resolver returns `null`, keep the semantic link node without route fields and add a diagnostic `unresolvedRichTextLink`. The site must be able to render that node as inert text rather than inventing a route.

- [ ] **Step 5: Emit graph rows from item presentations**

In `emit-read-models.ts`, create graph rows before finalizing rich-text JSON for `item_presentation_rows`:

- execute `ENTITY_GRAPH_DDL`;
- insert public item nodes for every item presentation with `route_path = "/items/" + itemId` and `canonical_slug = itemId`;
- insert aliases for unique display names; duplicate aliases go to `entity_disambiguations` and emit a `duplicateAliasDisambiguated` pipeline diagnostic;
- insert public term nodes for each requirement id and each translated tooltip term-link id as `entity_type = 'term'`, `entity_id = term id`, `label = label`, `route_path = null`, `is_public = 1`;
- insert `requires_stat` edges from item to term with evidence `{ source: requirement.source, field: "presentation.requirements" }`;
- insert non-public spell placeholder nodes and `casts_spell` edges when fixture fields include `spellDataJson.id` and the target does not yet have a public spell node;
- build a resolver from `entity_nodes`, `entity_aliases`, and `entity_disambiguations`, then call `translateRichTextV1` with that resolver for description/effects before storing `description_rich_text_json` and `effects_rich_text_json`;
- insert rich-text diagnostics into `pipeline_diagnostics` with source `rich-text`;
- run `auditEntityGraph(db)` after graph emission and insert all audit diagnostics with source `relationship-graph`;
- throw if any graph audit diagnostic has `severity === "fatal"`.

- [ ] **Step 6: Materialize relationship sections**

Materialize `entity_relationship_sections` as JSON arrays ordered by section position, predicate, weight descending, and target label.

`entity_relationship_sections` shape:

```sql
CREATE TABLE entity_relationship_sections (
  source_type    TEXT NOT NULL,
  source_id      TEXT NOT NULL,
  section_id     TEXT NOT NULL,
  title          TEXT NOT NULL,
  position       INTEGER NOT NULL,
  edges_json     TEXT NOT NULL,
  PRIMARY KEY (source_type, source_id, section_id)
);
```

Each edge JSON object must include `edgeId`, `predicate`, `label`, `targetType`, `targetId`, `targetLabel`, `targetRoutePath`, `targetIsPublic`, `evidence`, and `anchor`. Non-public targets remain present in data with `targetIsPublic = false`; Svelte renders them inert, never as normal links.

- [ ] **Step 7: Extend read-model tests for relationship sections and resolved links**

In `pipeline/test/read-models.test.ts`, assert:

```ts
const sections = db
  .query(
    "SELECT section_id, title, edges_json FROM entity_relationship_sections WHERE source_type = 'item' AND source_id = 'fixture-iron-sword'",
  )
  .all() as { section_id: string; title: string; edges_json: string }[];

expect(sections).toContainEqual(
  expect.objectContaining({ section_id: "requires", title: "Requires" }),
);
expect(
  JSON.parse(sections.find((section) => section.section_id === "requires")!.edges_json),
).toContainEqual(
  expect.objectContaining({ predicate: "requires_stat", targetType: "term", targetId: "strength" }),
);

const richDescription = db
  .query(
    "SELECT description_rich_text_json FROM item_presentation_rows WHERE item_id = 'fixture-stamina-draught'",
  )
  .get() as { description_rich_text_json: string };
expect(JSON.parse(richDescription.description_rich_text_json).nodes).toContainEqual(
  expect.objectContaining({
    type: "termLink",
    termId: "stamina",
    targetType: "term",
    targetId: "stamina",
    targetIsPublic: true,
  }),
);

const diagnostics = db
  .query("SELECT code, source FROM pipeline_diagnostics ORDER BY code")
  .all() as { code: string; source: string }[];
expect(diagnostics.some((diagnostic) => diagnostic.source === "relationship-graph")).toBe(true);
```

- [ ] **Step 8: Run tests to verify GREEN**

Run:

```sh
bun test pipeline/test/relationship-graph.test.ts pipeline/test/rich-text-v1.test.ts pipeline/test/read-models.test.ts
```

Expected: pass.

- [ ] **Step 9: Commit relationship graph emission**

Run:

```sh
git add pipeline/src/relationships/relationship-graph.ts pipeline/src/rich-text/rich-text-v1.ts pipeline/src/stages/emit-read-models.ts pipeline/test/relationship-graph.test.ts pipeline/test/rich-text-v1.test.ts pipeline/test/read-models.test.ts
git commit -m "feat(pipeline): emit item relationship graph"
```

---

### Task 6: Surface Slice 4 diagnostics and manifest counts

**Files:**

- Modify: `pipeline/src/artifacts/manifest.ts`
- Modify: `pipeline/src/types.ts`
- Modify: `schemas/artifact-manifest.schema.json`
- Test: `pipeline/test/artifact-manifest.test.ts`
- Modify: `site/scripts/smoke-prerender-output.mjs`

- [ ] **Step 1: Write failing manifest count tests**

In `pipeline/test/artifact-manifest.test.ts`, add assertions to the artifact manifest test:

```ts
expect(manifest.counts.itemPresentationRows).toBe(manifest.counts.snapshotItems);
expect(manifest.counts.entityNodes).toBeGreaterThanOrEqual(manifest.counts.snapshotItems);
expect(manifest.counts.entityEdges).toBeGreaterThanOrEqual(1);
expect(manifest.counts.relationshipSections).toBeGreaterThanOrEqual(1);
expect(manifest.counts.itemPresentationDiagnostics).toBeGreaterThanOrEqual(0);
expect(manifest.counts.relationshipDiagnostics).toBe(0);
expect(manifest.counts.richTextDiagnostics).toBeGreaterThan(0);
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```sh
bun test pipeline/test/artifact-manifest.test.ts
```

Expected: fail because the counts are not emitted yet.

- [ ] **Step 3: Add counts in manifest builder**

In `pipeline/src/artifacts/manifest.ts`, replace `itemDetailRows` count with:

```ts
itemPresentationRows: countRows(sqlitePath, "item_presentation_rows"),
entityNodes: countRows(sqlitePath, "entity_nodes"),
entityAliases: countRows(sqlitePath, "entity_aliases"),
entityDisambiguations: countRows(sqlitePath, "entity_disambiguations"),
entityEdges: countRows(sqlitePath, "entity_edges"),
relationshipSections: countRows(sqlitePath, "entity_relationship_sections"),
itemPresentationDiagnostics: countItemPresentationDiagnostics(sqlitePath),
relationshipDiagnostics: countPipelineDiagnostics(sqlitePath, "relationship-graph"),
richTextDiagnostics: countPipelineDiagnostics(sqlitePath, "rich-text"),
```

Add `countItemPresentationDiagnostics(sqlitePath)` that parses `diagnostics_json` from `item_presentation_rows` and returns the total diagnostic count. Add `countPipelineDiagnostics(sqlitePath, source)` that counts `pipeline_diagnostics` rows by source (`rich-text` and `relationship-graph`) and returns `0` when the diagnostics table is absent, so older fixture artifacts fail by missing required Slice 4 row counts in tests rather than by crashing manifest generation. Also add a focused helper test that creates an in-memory `pipeline_diagnostics` table with one `rich-text` row and one `relationship-graph` row, then asserts `countPipelineDiagnostics` returns `1` for each source. This prevents manifest counters from being hardcoded zero while still allowing the clean synthetic relationship graph to report zero relationship-audit rows.

- [ ] **Step 4: Ensure artifact schema accepts the generated counts**

`schemas/artifact-manifest.schema.json` already allows integer values under `counts`. Keep that shape; do not add a fixed required list of count keys. Run validators after code changes to prove the manifest remains valid.

- [ ] **Step 5: Update prerender smoke for Slice 4 HTML**

In `site/scripts/smoke-prerender-output.mjs`, after reading `detail`, assert these snippets and every curated variant page linked from `/items`:

```js
for (const snippet of [
  "item-presentation-panel",
  "item-stat-block",
  "relationship-section",
  "item-tooltip-card",
]) {
  if (!detail.includes(snippet)) throw new Error(`detail HTML missing ${snippet}`);
}
if (!overview.includes("item-tooltip-card")) {
  throw new Error("overview HTML missing item-tooltip-card");
}

const categoryHrefs = [...overview.matchAll(/href="(\/items\/variant\/[^"]+)"/g)].map(
  (match) => match[1],
);
if (categoryHrefs.length === 0) {
  throw new Error("overview HTML missing curated variant category links");
}
for (const categoryHref of categoryHrefs) {
  const categoryPath = firstExisting([
    join(outputDir, `${categoryHref}.html`),
    join(outputDir, categoryHref, "index.html"),
  ]);
  if (!categoryPath) throw new Error(`missing prerendered category page for ${categoryHref}`);
  const category = readFileSync(categoryPath, "utf8");
  for (const snippet of ["item-category-page", "<table", "/items/"]) {
    if (!category.includes(snippet)) throw new Error(`category HTML missing ${snippet}`);
  }
  const variant = categoryHref.split("/").at(-1);
  if (variant && !category.includes(variant)) {
    throw new Error(`category HTML missing variant marker ${variant}`);
  }
  if (category.includes("_app/immutable/entry/app")) {
    throw new Error("category page should not require hydration");
  }
}
```

Keep the existing no-hydration detail assertion.

- [ ] **Step 6: Run tests to verify GREEN**

Run:

```sh
bun test pipeline/test/artifact-manifest.test.ts
```

Expected: pass.

- [ ] **Step 7: Commit manifest diagnostics**

Run:

```sh
git add pipeline/src/artifacts/manifest.ts pipeline/src/types.ts schemas/artifact-manifest.schema.json pipeline/test/artifact-manifest.test.ts site/scripts/smoke-prerender-output.mjs
git commit -m "feat(pipeline): report item presentation diagnostics"
```

---

### Task 7: Add site read models, components, and catalog guardrails

**Files:**

- Modify: `site/src/lib/server/read-models.ts`
- Modify: `site/src/lib/components/EntityTable.svelte`
- Create: `site/src/lib/components/COMPONENTS.json`
- Create: `site/src/lib/components/content/RichText.svelte`
- Create: `site/src/lib/components/content/RichTextNode.svelte`
- Create: `site/src/lib/components/items/ItemIcon.svelte`
- Create: `site/src/lib/components/items/ItemHeader.svelte`
- Create: `site/src/lib/components/items/ItemStatRow.svelte`
- Create: `site/src/lib/components/items/ItemStatBlock.svelte`
- Create: `site/src/lib/components/items/ItemRequirementList.svelte`
- Create: `site/src/lib/components/items/ItemEffectList.svelte`
- Create: `site/src/lib/components/items/ItemStateFacts.svelte`
- Create: `site/src/lib/components/items/ItemPresentationPanel.svelte`
- Create: `site/src/lib/components/items/ItemTooltipCard.svelte`
- Create: `site/src/lib/components/relationships/EntityLink.svelte`
- Create: `site/src/lib/components/relationships/RelatedEntityCard.svelte`
- Create: `site/src/lib/components/relationships/RelationshipSection.svelte`
- Modify: `site/src/app.css`
- Test: `tooling.test.ts`

- [ ] **Step 1: Write failing component catalog and safety guardrails**

Add to `tooling.test.ts`:

```ts
const componentCatalogPath = "site/src/lib/components/COMPONENTS.json";

it("catalogs Slice 4 shared components with discoverable metadata", () => {
  expect(existsSync(componentCatalogPath)).toBe(true);
  const catalog = JSON.parse(readFileSync(componentCatalogPath, "utf8")) as {
    components: {
      name: string;
      importPath: string;
      purpose: string;
      props: string[];
      aliases: string[];
      accessibility: string;
    }[];
  };
  const names = new Set(catalog.components.map((component) => component.name));
  for (const name of [
    "RichText",
    "ItemIcon",
    "ItemHeader",
    "ItemStatBlock",
    "ItemRequirementList",
    "ItemEffectList",
    "ItemStateFacts",
    "ItemPresentationPanel",
    "ItemTooltipCard",
    "EntityLink",
    "RelationshipSection",
    "RelatedEntityCard",
    "ItemOverviewFilters",
  ]) {
    expect(names.has(name)).toBe(true);
  }
  for (const component of catalog.components) {
    expect(component.importPath.startsWith("$lib/components/")).toBe(true);
    expect(component.purpose.length).toBeGreaterThan(20);
    expect(component.aliases.length).toBeGreaterThan(0);
    expect(component.accessibility.length).toBeGreaterThan(20);
  }
});

it("keeps item presentation components off raw html rendering", () => {
  for (const path of [
    "site/src/lib/components/content/RichText.svelte",
    "site/src/lib/components/content/RichTextNode.svelte",
    "site/src/lib/components/items/ItemPresentationPanel.svelte",
    "site/src/routes/items/[id]/+page.svelte",
  ]) {
    if (!existsSync(path)) continue;
    expect(readFileSync(path, "utf8")).not.toContain("{@html");
  }
});

it("removes legacy item_detail_rows fields_json public plumbing", () => {
  const readModels = readFileSync("site/src/lib/server/read-models.ts", "utf8");
  const detailLoader = readFileSync("site/src/routes/items/[id]/+page.server.ts", "utf8");
  expect(readModels).not.toContain("item_detail_rows");
  expect(readModels).not.toContain("fields_json");
  expect(detailLoader).not.toContain("fields_json");
  expect(detailLoader).not.toContain('listDetailSections("item")');
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```sh
bun test tooling.test.ts --test-name-pattern "catalogs Slice 4|raw html|legacy item_detail"
```

Expected: fail because catalog/components do not exist and legacy accessors still exist.

- [ ] **Step 3: Add semantic tokens**

In `site/src/app.css`, add token mappings under `@theme inline`:

```css
--color-surface-panel: var(--surface-panel);
--color-surface-panel-muted: var(--surface-panel-muted);
--color-text-link: var(--text-link);
--color-text-link-hover: var(--text-link-hover);
--color-text-requirement: var(--text-requirement);
--color-text-diagnostic: var(--text-diagnostic);
--color-border-panel: var(--border-panel);
--color-border-tooltip: var(--border-tooltip);
```

Add values under `:root` using existing palette variables, not hardcoded route-local values:

```css
--surface-panel: oklch(0.14 0.02 260);
--surface-panel-muted: oklch(0.17 0.02 260);
--text-link: var(--primary);
--text-link-hover: oklch(0.78 0.18 50);
--text-requirement: oklch(0.78 0.12 80);
--text-diagnostic: oklch(0.74 0.16 35);
--border-panel: var(--border);
--border-tooltip: oklch(0.38 0.03 260);
```

- [ ] **Step 4: Add typed site read-model accessors**

In `site/src/lib/server/read-models.ts`:

- remove `ItemDetailRecord`, `ItemDetailRow`, and `getItemDetail`;
- change `listItemIds` to query `item_presentation_rows`;
- add exported types `RichTextV1`, `RichTextNode`, `ItemPresentationRow`, `RelationshipSectionRow`, `ItemOverviewFilter`;
- add `getItemPresentation(itemId)`, `getItemTooltip(itemId)`, `listItemTooltips()`, `listEntityRelationshipSections(entityType, entityId)`, `listItemOverviewFilters()`, and `getEntityLinkTarget(entityType, entityId)`;
- parse JSON columns inside these accessors and return typed arrays/objects.

- [ ] **Step 5: Add component catalog**

Create `site/src/lib/components/COMPONENTS.json` with `schemaVersion: 1` and one entry for every component listed in the guardrail test. Include `useWhen`, `doNotUseWhen`, `related`, `tokens`, `examples`, and `accessibility` for each entry.

- [ ] **Step 6: Add RichText renderer**

Create `site/src/lib/components/content/RichText.svelte`:

```svelte
<script lang="ts">
  import RichTextNode from "./RichTextNode.svelte";
  import type { RichTextV1 } from "$lib/server/read-models";

  type Props = { value: RichTextV1; class?: string };
  let { value, class: className = "" }: Props = $props();
</script>

<span class={className} data-rich-text-schema="rich_text_v1">
  {#each value.nodes as node, index (`${node.type}-${index}`)}
    <RichTextNode {node} />
  {/each}
</span>
```

Create `RichTextNode.svelte` with branches for each node type and escaped text bindings. `entityLink` and `termLink` can render anchors only when route data is already present in the node; otherwise render `<span>` text. Do not use `{@html}`.

- [ ] **Step 7: Add item and relationship components**

Implement components with typed props from `read-models.ts`:

- `ItemIcon` renders the existing icon box and image with `item-icon` class.
- `ItemHeader` composes `ItemIcon`, display name, item type, value, and weight.
- `ItemStatRow` and `ItemStatBlock` render semantic lists with `item-stat-block` class.
- `ItemRequirementList`, `ItemEffectList`, and `ItemStateFacts` render sections only when arrays/content are non-empty.
- `ItemPresentationPanel` composes header, rich description/effects, stats, requirements, durability, state facts, omissions, and relationship sections; top element includes `data-component="item-presentation-panel"` and `item-presentation-panel` class.
- `ItemTooltipCard` renders a compact static card for item links and relationship links without requiring hydration; top element includes class `item-tooltip-card`.
- `EntityTable` accepts optional `itemTooltipsById` for `itemNameWithIcon` cells and renders the matching `ItemTooltipCard` inside the item link/focus region as static HTML.
- `EntityLink` renders an `<a>` only when `targetIsPublic` and `targetRoutePath` are truthy; otherwise renders inert text with `aria-disabled="true"`.
- `RelationshipSection` top element includes `relationship-section` class and delegates cards/links.

- [ ] **Step 8: Run catalog and raw-HTML guardrails**

Run:

```sh
bun test tooling.test.ts --test-name-pattern "catalogs Slice 4|raw html"
```

Expected: pass. The legacy clean-cutover guardrail is completed in Task 8, after the route loader stops importing the old detail accessors.

---

### Task 8: Cut item detail route over to presentation components

**Files:**

- Modify: `site/src/routes/items/[id]/+page.server.ts`
- Modify: `site/src/routes/items/[id]/+page.svelte`
- Modify: `site/src/lib/server/read-models.ts`
- Test: `tooling.test.ts`

- [ ] **Step 1: Rewrite item detail loader for presentation data**

Replace the loader in `site/src/routes/items/[id]/+page.server.ts` with:

```ts
import { error } from "@sveltejs/kit";
import {
  getItemPresentation,
  listEntityRelationshipSections,
  listItemIds,
} from "$lib/server/read-models";
import type { EntryGenerator, PageServerLoad } from "./$types";

export const prerender = true;

export const entries: EntryGenerator = () => listItemIds().map((id) => ({ id }));

export const load: PageServerLoad = ({ params }) => {
  const presentation = getItemPresentation(params.id);
  if (!presentation) throw error(404, "Item not found");

  return {
    presentation,
    relationshipSections: listEntityRelationshipSections("item", params.id),
  };
};
```

- [ ] **Step 2: Rewrite item detail page as route assembly**

Replace `site/src/routes/items/[id]/+page.svelte` with a page that imports only route-level path helpers and shared components:

```svelte
<script lang="ts">
  import { resolve } from "$app/paths";
  import ItemPresentationPanel from "$lib/components/items/ItemPresentationPanel.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>{data.presentation.displayName} | Ardenfall Compendium</title>
</svelte:head>

<a class="text-text-link hover:text-text-link-hover text-sm underline" href={resolve("/items")}
  >← back to items</a
>

<ItemPresentationPanel
  presentation={data.presentation}
  relationshipSections={data.relationshipSections}
/>
```

The route file must not import `FieldList`, `sectionRegistry`, or parse JSON.

- [ ] **Step 3: Run site guardrails to verify GREEN**

Run:

```sh
bun test tooling.test.ts --test-name-pattern "catalogs Slice 4|raw html|legacy item_detail"
```

Expected: pass.

- [ ] **Step 4: Run Svelte check for typed props**

Run:

```sh
bun run --cwd site check
```

Expected: pass.

- [ ] **Step 5: Commit site detail cutover and components**

Run:

```sh
git add site/src/app.css site/src/lib/server/read-models.ts site/src/lib/components/EntityTable.svelte site/src/lib/components/COMPONENTS.json site/src/lib/components/content site/src/lib/components/items site/src/lib/components/relationships site/src/routes/items/[id]/+page.server.ts site/src/routes/items/[id]/+page.svelte tooling.test.ts
git commit -m "feat(site): render item presentation components"
```

---

### Task 9: Add static-first item overview URL-state filters and curated variant pages

**Files:**

- Create: `site/src/lib/components/items/item-overview-filter-state.ts`
- Create: `site/src/lib/components/items/item-overview-filter-state.test.ts`
- Create: `site/src/lib/components/items/ItemOverviewFilters.svelte`
- Modify: `site/src/routes/items/+page.server.ts`
- Create: `site/src/routes/items/+page.ts`
- Modify: `site/src/routes/items/+page.svelte`
- Create: `site/src/routes/items/variant/[variant]/+page.server.ts`
- Create: `site/src/routes/items/variant/[variant]/+page.svelte`
- Modify: `site/src/lib/server/read-models.ts`
- Modify: `pipeline/src/stages/emit-read-models.ts`
- Test: `pipeline/test/read-models.test.ts`

- [ ] **Step 1: Write failing pure URL-state tests**

Create `site/src/lib/components/items/item-overview-filter-state.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import {
  canonicalizeItemOverviewSearch,
  filterAndSortItemRows,
  parseItemOverviewSearch,
} from "./item-overview-filter-state";

const filters = [
  { key: "variant", label: "Variant", kind: "multi", values: ["armor", "melee-weapon"] },
  { key: "hasRequirements", label: "Has requirements", kind: "boolean", values: ["true"] },
] as const;

const rows = [
  {
    id: "sword",
    name: "Iron Sword",
    variant: "melee-weapon",
    itemType: "Melee weapon",
    value: 25,
    weight: 3.5,
    hasRequirements: true,
    hasEffects: false,
    hasDurability: true,
    displayIconSrc: null,
    displayIconColor: null,
  },
  {
    id: "tunic",
    name: "Leather Tunic",
    variant: "armor",
    itemType: "Armor",
    value: 12,
    weight: 4,
    hasRequirements: false,
    hasEffects: false,
    hasDurability: true,
    displayIconSrc: null,
    displayIconColor: null,
  },
];

describe("item overview URL state", () => {
  it("drops unknown keys and sorts multi-value filters canonically", () => {
    const state = parseItemOverviewSearch(
      "?unknown=x&variant=melee-weapon,armor&sort=name&direction=asc",
      filters,
    );

    expect(state.filters.variant).toEqual(["armor", "melee-weapon"]);
    expect(canonicalizeItemOverviewSearch(state, filters)).toBe("variant=armor,melee-weapon");
  });

  it("filters and sorts already-loaded rows without changing the no-JS source rows", () => {
    const state = parseItemOverviewSearch("?variant=armor&sort=value&direction=desc", filters);

    expect(filterAndSortItemRows(rows, state).map((row) => row.id)).toEqual(["tunic"]);
    expect(rows.map((row) => row.id)).toEqual(["sword", "tunic"]);
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```sh
bun test site/src/lib/components/items/item-overview-filter-state.test.ts
```

Expected: fail because filter-state helpers do not exist.

- [ ] **Step 3: Emit overview filter and category metadata**

In `pipeline/src/stages/emit-read-models.ts`, add:

```sql
CREATE TABLE item_overview_filters (
  filter_key TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  kind       TEXT NOT NULL,
  values_json TEXT NOT NULL,
  position   INTEGER NOT NULL
);

CREATE TABLE item_overview_categories (
  category_key TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  route_path   TEXT NOT NULL,
  filter_key   TEXT NOT NULL,
  filter_value TEXT NOT NULL,
  item_count   INTEGER NOT NULL,
  position     INTEGER NOT NULL
);
```

Populate `variant`, `itemType`, `hasRequirements`, `hasEffects`, and `hasDurability` from `item_overview_rows` + `item_presentation_rows`. Add read-model tests that assert `variant` values are sorted, boolean filters contain only `true` when at least one row has the fact, and `item_overview_categories` contains one durable crawlable category per variant with route paths like `/items/variant/melee-weapon`.

- [ ] **Step 4: Extend overview rows with generated facts**

Add these columns to `item_overview_rows`: `item_type`, `has_requirements`, `has_effects`, `has_durability`. Populate them from presentation data. Update `ItemOverviewRow` in `site/src/lib/server/read-models.ts` with `itemType`, `hasRequirements`, `hasEffects`, `hasDurability`.

- [ ] **Step 5: Implement pure URL-state helpers**

Create `item-overview-filter-state.ts` exporting:

- `parseItemOverviewSearch(search, filters)`;
- `canonicalizeItemOverviewSearch(state, filters)`;
- `filterAndSortItemRows(rows, state)`.

Rules:

- allowed keys come from filter metadata;
- defaults are omitted;
- multi-value filters are sorted by stable value key;
- unknown keys/values are ignored;
- canonical order is filter keys alphabetically, then `sort`, then `direction`;
- sorting supports only `name`, `value`, `weight`, `variant`, and `itemType`.

- [ ] **Step 6: Implement `ItemOverviewFilters.svelte` and route CSR opt-in**

Create `ItemOverviewFilters.svelte` that uses the pure helpers, updates `history.replaceState`, filters the already-loaded rows, and passes `itemTooltipsById` into `EntityTable` so item-name links include static `ItemTooltipCard` markup. It must keep the server-rendered rows as its initial content so no-JS users see the full table.

Create `site/src/routes/items/+page.ts`:

```ts
// Slice 4 opts only this route into CSR for bounded URL-state filtering/sorting.
// Item detail routes remain static HTML without hydration.
export const csr = true;
```

Update `site/src/routes/items/+page.server.ts` to return `filters: listItemOverviewFilters()`, `categories: listItemOverviewCategories()`, and `itemTooltipsById` built from `listItemTooltips()`.

Update `site/src/routes/items/+page.svelte` to render:

```svelte
<ItemOverviewFilters
  rows={data.rows}
  columns={data.columns}
  filters={data.filters}
  categories={data.categories}
  itemTooltipsById={data.itemTooltipsById}
/>
```

and move `EntityTable` usage inside the component. The component must render ordinary links to curated category pages before any client-side controls so no-JS users and crawlers can navigate durable variant slices without query-param URLs, and item-name links must include `item-tooltip-card` markup in the prerendered HTML.

- [ ] **Step 7: Add curated variant pages**

Create `site/src/routes/items/variant/[variant]/+page.server.ts`:

```ts
import { error } from "@sveltejs/kit";
import {
  getItemOverviewCategory,
  listItemOverviewCategories,
  listItemsOverview,
  listOverviewColumns,
} from "$lib/server/read-models";
import type { EntryGenerator, PageServerLoad } from "./$types";

export const prerender = true;

export const entries: EntryGenerator = () =>
  listItemOverviewCategories().map((category) => ({ variant: category.filterValue }));

export const load: PageServerLoad = ({ params }) => {
  const category = getItemOverviewCategory("variant", params.variant);
  if (!category) throw error(404, "Item category not found");

  return {
    category,
    columns: listOverviewColumns("item"),
    rows: listItemsOverview().filter((row) => row.variant === params.variant),
  };
};
```

Create `site/src/routes/items/variant/[variant]/+page.svelte` as a static page whose top-level content has class `item-category-page`, with a heading, back link to `/items`, and `EntityTable` using `rowHref={(row) => resolve("/items/[id]", { id: row.id })}`. Do not opt this route into CSR.

- [ ] **Step 8: Run tests and Svelte check to verify GREEN**

Run:

```sh
bun test site/src/lib/components/items/item-overview-filter-state.test.ts pipeline/test/read-models.test.ts
bun run --cwd site check
```

Expected: pass.

- [ ] **Step 9: Commit overview filters and curated pages**

Run:

```sh
git add pipeline/src/stages/emit-read-models.ts pipeline/test/read-models.test.ts site/src/lib/server/read-models.ts site/src/lib/components/items/ItemOverviewFilters.svelte site/src/lib/components/items/item-overview-filter-state.ts site/src/lib/components/items/item-overview-filter-state.test.ts site/src/routes/items/+page.server.ts site/src/routes/items/+page.ts site/src/routes/items/+page.svelte site/src/routes/items/variant/[variant]/+page.server.ts site/src/routes/items/variant/[variant]/+page.svelte site/src/lib/components/COMPONENTS.json
git commit -m "feat(site): add item overview URL filters"
```

---

### Task 10: Verify artifact build, prerender output, and roadmap state

**Files:**

- Modify: `docs/superpowers/roadmap.md`
- Optional modify: `docs/superpowers/plans/2026-05-19-item-presentation-depth.md` with checked boxes if maintaining progress in-tree during implementation.

- [ ] **Step 1: Update roadmap implementation state**

Update `docs/superpowers/roadmap.md` Slice 4:

```md
**Status:** in progress
**Plan:** `docs/superpowers/plans/2026-05-19-item-presentation-depth.md`.
```

After final verification passes, change status to `done`, record completion date `2026-05-19`, and list any spec deviations. If no deviations occurred, write `**Spec deviations:** none.`

- [ ] **Step 2: Build a fixture artifact**

Run:

```sh
bun run artifact:fixture synthetic fixtures/synthetic/snapshot
```

Expected: `pipeline/artifacts/fixtures/synthetic/artifact-manifest.json` exists and contains `itemPresentationRows`, `entityNodes`, `entityEdges`, `relationshipSections`, `richTextDiagnostics`, and `relationshipDiagnostics` counts. The old pre-Slice-4 live snapshot under `snapshots/snapshots/0.0.10.91-20260515-1414238114030` is not a valid Slice 4 release input because its item rows predate `presentation`; use it only as a reminder that a fresh live export is required before release/deploy.

- [ ] **Step 3: Build and smoke the static site**

Run:

```sh
bun run --cwd site build:fixture
bun run --cwd site smoke:prerender
bun run --cwd site smoke:item-icons
bun run --cwd site smoke:error-route
```

Expected: all pass; `/items` HTML contains ordinary curated variant links and `item-tooltip-card` markup for item-name links; every linked `/items/variant/...` page exists with `item-category-page` and table markup; `/items/[id]` HTML includes `item-presentation-panel`, `item-stat-block`, and `relationship-section`; item detail and category pages do not ship the hydration entry by default.

- [ ] **Step 4: Record live-release validation gate**

Before declaring a deployable release, run the updated mod against Ardenfall Demo `0.0.10.91` to create a fresh snapshot whose `items.json.schemaVersion` is `2`. Set `FRESH_SLICE4_SNAPSHOT_ID` to the new snapshot directory name produced by that export, then run:

```sh
bun run artifact:release "snapshots/snapshots/$FRESH_SLICE4_SNAPSHOT_ID"
bun run --cwd site scripts/smoke-production-release.mjs "../pipeline/artifacts/releases/$FRESH_SLICE4_SNAPSHOT_ID/artifact-manifest.json"
```

Expected: the release artifact manifest includes nonzero `itemPresentationRows`, rich-text/link diagnostic counts, and production `/_release.json` matches the intended artifact after an explicit deploy. Do not run production smoke or deploy commands unless the user explicitly asks for a deployment; if no fresh live export is available, record this as a release-readiness gate, not as a local implementation blocker.

- [ ] **Step 5: Run full local verification gates**

Run:

```sh
dotnet test mod-tests/ArdenfallCompendium.Tests.csproj
bun test pipeline/test
bun test tooling.test.ts site/src/lib/components/items/item-overview-filter-state.test.ts
bun run typecheck
bun run --cwd site check
bun run format:check
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit roadmap finalization**

Run:

```sh
git add docs/superpowers/roadmap.md docs/superpowers/plans/2026-05-19-item-presentation-depth.md
git commit -m "docs(site): complete item presentation depth plan"
```

- [ ] **Step 7: Request final review**

Dispatch final review with this scope:

- Compare implementation against `docs/superpowers/specs/2026-05-19-item-presentation-depth-design.md` acceptance criteria 1–14.
- Check clean cutover from `item_detail_rows.fields_json` public plumbing.
- Check no raw `{@html}` in item presentation path.
- Check route files assemble shared components only.
- Check `/items` CSR is bounded to URL-state filtering and item detail pages remain static.
- Check diagnostics/manifest counts are actually generated, not hardcoded.

Address Critical and Important findings before final status.
