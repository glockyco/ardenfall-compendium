[← Previous phase](09-composer-port.md) · [Next phase →](11-spell.md) · [Coordinator](../2026-05-20-items-presentation-closure.md)

# Phase 10: `status-effect` entity + composer port

**Spec coverage:** §3.2, §4.3, §7.3.

**Why tenth:** consumables, throwing potions, weapon-bleed effects, and weapon-enchantment on-hit lines all compose their tooltip body through `StatusEffectData.GetTooltip()`. Phase 10 extracts every `StatusEffectData` asset (with full `Effect[]` payloads via Phase 7's serializer) AND ports `StatusEffectTooltip.GetTooltip` to TypeScript so the pipeline materialises the composed text into `status_effect_presentation_rows`. This is also the first phase that exercises the composer port + golden harness from Phase 9 against real game data — every status effect in the fixture has a golden snapshot the composer must reproduce byte-exactly.

Phase 10 is also the **canonical "composer-entity template"** — Phases 11 (spell) and 12 (enchantment) instantiate the same eight-task shape.

**Outcome:** every `StatusEffectData` asset in the live snapshot is exported with its `tooltipTemplate`, `tooltipVariables`, full `Effect[]` payloads (via `EffectSerializer`), `modifyStatusEffects`, color, skin-color, and metadata flags; the pipeline canonicalises into `status_effects` + `effect_instances` + read-models; the composer port composes the tooltip text deterministically and matches captured in-game strings; `/status-effects` + `/status-effects/[slug]` pages render the composed text + structured atoms.

## The composer-entity template

Eight task slots, parallel to the small-entity template:

1. **Mod DTO** for the entity itself (the asset's fields plus the tooltip template + variables).
2. **Mod extractor** that walks the asset graph, runs `EffectSerializer` on every `effects[]` member, populates the audit pass.
3. **Mod walker registration** + golden capture instrumentation (the one-time `compendium.captureGoldens` command that dumps composed strings from the running game).
4. **Pipeline descriptor + envelope schema** for the entity + the effect_instances table.
5. **Pipeline canonicaliser** that writes the entity row + `effect_instances` rows + audit-driven Zod validation.
6. **Composer port** that consumes the typed snapshot + master-tooltip vocabulary + audit and produces `rich_text_v1` documents + structured atoms.
7. **Pipeline read-model** + composed-text persistence + golden-file tests.
8. **Site overview + detail pages** that render the composed text + reverse-relationship sections.

## Phase 10 inputs

| Template parameter          | Phase 10 value                                   |
| --------------------------- | ------------------------------------------------ |
| Entity id                   | `status-effect`                                  |
| Plural id                   | `status-effects`                                 |
| Asset C# type               | `Ardenfall.StatusEffectData`                     |
| Mod namespace               | `ArdenfallCompendium.Entities.StatusEffect`      |
| Composer module             | `pipeline/src/composer/status-effect-tooltip.ts` |
| Canonical table             | `status_effects`                                 |
| Effect instance owner_type  | `status-effect`                                  |
| Effect instance owner_scope | `status-effect-effects`                          |
| Render context              | `status-effect-presentation-v1`                  |
| Site overview route         | `/status-effects`                                |
| Site detail route           | `/status-effects/[slug]`                         |
| Slug source                 | `statusEffectName`                               |
| Golden patch                | `0.0.10.91-anchor`                               |

## Tasks

### Task 10.1: Mod DTO — `StatusEffectSnapshot`

**Files:**

- Create: `mod/src/Entities/StatusEffect/StatusEffectSnapshot.cs`
- Create: `mod/src/Entities/StatusEffect/StatusEffectTooltipSnapshot.cs`
- Create: `mod/src/Entities/StatusEffect/ModifyStatusEffectSnapshot.cs`
- Create: `mod/src/Entities/StatusEffect/StatusEffectSkinColorSnapshot.cs`
- Test: `mod-tests/StatusEffectSnapshotTests.cs`

- [ ] **Step 1: Implement the DTOs**

```cs
// mod/src/Entities/StatusEffect/StatusEffectSnapshot.cs
using System.Collections.Generic;
using ArdenfallCompendium.Assets;
using ArdenfallCompendium.Effects.Serialization;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.StatusEffect;

public sealed record StatusEffectSnapshot(
    [property: JsonProperty("id")] string Id,
    [property: JsonProperty("statusEffectName")] string StatusEffectName,
    [property: JsonProperty("characterNameModifier")] string? CharacterNameModifier,
    [property: JsonProperty("iconRef")] object? IconRef,
    [property: JsonProperty("tooltip")] StatusEffectTooltipSnapshot Tooltip,
    [property: JsonProperty("effects")] List<EffectInstanceSnapshot> Effects,
    [property: JsonProperty("modifyStatusEffects")] List<ModifyStatusEffectSnapshot> ModifyStatusEffects,
    [property: JsonProperty("color")] AppliedColorSerializedSnapshot Color,
    [property: JsonProperty("skinColorAssetRef")] object? SkinColorAssetRef,
    [property: JsonProperty("skinColor")] StatusEffectSkinColorSnapshot? SkinColor,
    [property: JsonProperty("skinColorImportance")] float SkinColorImportance,
    [property: JsonProperty("enableSkinColor")] bool EnableSkinColor,
    [property: JsonProperty("customSkinColorColor")] bool CustomSkinColorColor,
    [property: JsonProperty("skinColorColor")] AssetColorSnapshot? SkinColorColor,
    [property: JsonProperty("isHostile")] bool IsHostile,
    [property: JsonProperty("isNegative")] bool IsNegative,
    [property: JsonProperty("isDisease")] bool IsDisease,
    [property: JsonProperty("isLegendary")] bool IsLegendary,
    [property: JsonProperty("itemMoneyCost")] float ItemMoneyCost,
    [property: JsonProperty("minLevel")] int MinLevel,
    [property: JsonProperty("forceAppearIfInfiniteLifetime")] bool ForceAppearIfInfiniteLifetime,
    [property: JsonProperty("onlyApplyToLifeMode")] List<string> OnlyApplyToLifeMode,
    [property: JsonProperty("aiType")] string AiType);
```

```cs
// mod/src/Entities/StatusEffect/StatusEffectTooltipSnapshot.cs
using System.Collections.Generic;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.StatusEffect;

public sealed record StatusEffectTooltipSnapshot(
    [property: JsonProperty("template")] string Template,
    [property: JsonProperty("variables")] List<TooltipVariableSnapshot> Variables);

public sealed record TooltipVariableSnapshot(
    [property: JsonProperty("componentIndex")] int ComponentIndex,
    [property: JsonProperty("variableName")] string VariableName,
    [property: JsonProperty("type")] string Type,
    [property: JsonProperty("isPercentage")] bool IsPercentage,
    [property: JsonProperty("oneMinus")] bool OneMinus,
    [property: JsonProperty("invert")] bool Invert,
    [property: JsonProperty("absoluteValue")] bool AbsoluteValue,
    [property: JsonProperty("isInt")] bool IsInt,
    [property: JsonProperty("rountToTenths")] bool RountToTenths,
    [property: JsonProperty("multiplier")] float Multiplier,
    [property: JsonProperty("add")] float Add);
```

```cs
// mod/src/Entities/StatusEffect/ModifyStatusEffectSnapshot.cs
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.StatusEffect;

public sealed record ModifyStatusEffectSnapshot(
    [property: JsonProperty("statusEffectRef")] object? StatusEffectRef,
    [property: JsonProperty("levelDelta")] float LevelDelta,
    [property: JsonProperty("durationDelta")] float DurationDelta,
    [property: JsonProperty("removeBeforeApply")] bool RemoveBeforeApply,
    [property: JsonProperty("count")] int Count);
```

```cs
// mod/src/Entities/StatusEffect/StatusEffectSkinColorSnapshot.cs
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.StatusEffect;

public sealed record StatusEffectSkinColorSnapshot(
    [property: JsonProperty("skinColorBias")] float SkinColorBias,
    [property: JsonProperty("skinColorScale")] float SkinColorScale,
    [property: JsonProperty("skinColorPower")] float SkinColorPower,
    [property: JsonProperty("skinColorEmission")] float SkinColorEmission,
    [property: JsonProperty("skinColorAdd")] float SkinColorAdd,
    [property: JsonProperty("skinColorMax")] float SkinColorMax,
    [property: JsonProperty("skinColorFadeSpeed")] float SkinColorFadeSpeed);
```

- [ ] **Step 2: Test record construction**

```cs
[Fact]
public void StatusEffectSnapshotCarriesEffectsAndVariables()
{
    var snap = new StatusEffectSnapshot(
        Id: "fixture-restore-health",
        StatusEffectName: "Restore Health",
        CharacterNameModifier: null,
        IconRef: null,
        Tooltip: new StatusEffectTooltipSnapshot(
            "Restores {0} {target} for {lifetime}.",
            new() { new TooltipVariableSnapshot(0, "totalDeltaTooltip", "None", false, false, false, false, true, false, 1f, 0f) }),
        Effects: new(),
        ModifyStatusEffects: new(),
        Color: new AppliedColorSerializedSnapshot(new(1, 1, 1, 1), true, true, true),
        SkinColorAssetRef: null, SkinColor: null,
        SkinColorImportance: 0, EnableSkinColor: false, CustomSkinColorColor: false, SkinColorColor: null,
        IsHostile: false, IsNegative: false, IsDisease: false, IsLegendary: false,
        ItemMoneyCost: 10, MinLevel: 1, ForceAppearIfInfiniteLifetime: false,
        OnlyApplyToLifeMode: new(), AiType: "Friend");

    Assert.Equal("fixture-restore-health", snap.Id);
    Assert.Single(snap.Tooltip.Variables);
}
```

- [ ] **Step 3: Run + commit**

Run: `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --filter StatusEffectSnapshotTests`

```sh
git add mod/src/Entities/StatusEffect/ mod-tests/StatusEffectSnapshotTests.cs
git commit -m "feat(mod): status-effect snapshot DTOs"
```

### Task 10.2: Mod extractor — `StatusEffectExtractor`

**Files:**

- Create: `mod/src/Entities/StatusEffect/IStatusEffectAssetSource.cs`
- Create: `mod/src/Entities/StatusEffect/StatusEffectExtractor.cs`
- Test: `mod-tests/StatusEffectExtractorTests.cs`

The extractor walks `BuiltLookupTable.GetAssetsOfType<StatusEffectData>()`, runs `EffectSerializer.Serialize` on every `effects[i]`, populates an `IStatusEffectAuditSource` adapter for the binding auditor (Phase 8), and yields a `StatusEffectSnapshot`.

- [ ] **Step 1: Asset source abstraction**

```cs
// mod/src/Entities/StatusEffect/IStatusEffectAssetSource.cs
using System.Collections.Generic;
using Ardenfall;

namespace ArdenfallCompendium.Entities.StatusEffect;

public interface IStatusEffectAssetSource
{
    IEnumerable<StatusEffectData> EnumerateStatusEffects();
}

public sealed class BuiltLookupTableStatusEffectAssetSource : IStatusEffectAssetSource
{
    public IEnumerable<StatusEffectData> EnumerateStatusEffects()
    {
        var lookup = BuiltLookupTable.Instance;
        if (lookup == null) yield break;
        foreach (var asset in lookup.GetAssetsOfType<StatusEffectData>())
            if (asset != null) yield return asset;
    }
}
```

- [ ] **Step 2: Extractor**

```cs
// mod/src/Entities/StatusEffect/StatusEffectExtractor.cs
using System.Collections.Generic;
using System.Linq;
using Ardenfall;
using ArdenfallCompendium.Assets;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Effects.Audit;
using ArdenfallCompendium.Effects.Serialization;
using ArdenfallCompendium.Walker;

namespace ArdenfallCompendium.Entities.StatusEffect;

public sealed class StatusEffectExtractor : WalkerBase<StatusEffectSnapshot>
{
    private readonly IStatusEffectAssetSource _source;
    private readonly EffectBindingAuditor _auditor;
    public List<EffectInstanceSnapshot> Effects { get; } = new();

    public StatusEffectExtractor(IStatusEffectAssetSource source, EffectBindingAuditor auditor)
    {
        _source = source;
        _auditor = auditor;
    }

    public override IEnumerable<StatusEffectSnapshot> Walk()
    {
        var lookup = BuiltLookupTable.Instance;
        var serializer = new EffectSerializer(Refs);
        foreach (var asset in _source.EnumerateStatusEffects())
        {
            if (!MarkVisited(asset)) continue;
            if (lookup == null) yield break;
            var guid = lookup.GetGuid(asset);
            if (guid is null || guid.Length == 0)
            {
                Diagnostics.Add(new Diagnostic
                {
                    Severity = "fatal",
                    Code = "lookupAssetGuidMissing",
                    Field = "id",
                    Message = $"StatusEffectData '{asset.name}' has no GUID",
                });
                continue;
            }

            var effectInstances = new List<EffectInstanceSnapshot>();
            for (int i = 0; i < (asset.effects?.Count ?? 0); i++)
            {
                var effect = asset.effects[i];
                if (effect == null) continue;
                var snap = serializer.Serialize(effect, guid, "status-effect-effects", i);
                effectInstances.Add(snap);
                Effects.Add(snap);
                Diagnostics.AddRange(snap.Diagnostics);
            }

            // Populate the audit pass.
            _auditor.AuditStatusEffect(new StatusEffectAuditAdapter(guid, asset));

            yield return new StatusEffectSnapshot(
                Id: guid,
                StatusEffectName: asset.statusEffectName ?? asset.name ?? guid,
                CharacterNameModifier: NullIfEmpty(asset.characterNameModifier),
                IconRef: Refs.ResolveAsset(asset.statusEffectIcon, "iconRef", guid, MissingPolicy.Diagnostic, "StatusEffectData.statusEffectIcon"),
                Tooltip: BuildTooltipSnapshot(asset),
                Effects: effectInstances,
                ModifyStatusEffects: BuildModifySnapshots(asset, guid),
                Color: SerializeAppliedColor(asset.Color),
                SkinColorAssetRef: Refs.ResolveAsset(asset.skinColorAsset, "skinColorAssetRef", guid, MissingPolicy.Diagnostic, "StatusEffectData.skinColorAsset"),
                SkinColor: asset.skinColor == null ? null : new StatusEffectSkinColorSnapshot(
                    asset.skinColor.skinColorBias, asset.skinColor.skinColorScale, asset.skinColor.skinColorPower,
                    asset.skinColor.skinColorEmission, asset.skinColor.skinColorAdd, asset.skinColor.skinColorMax,
                    asset.skinColor.skinColorFadeSpeed),
                SkinColorImportance: asset.skinColorImportance,
                EnableSkinColor: asset.enableSkinColor,
                CustomSkinColorColor: asset.customSkinColorColor,
                SkinColorColor: asset.customSkinColorColor ? AssetColorSnapshot.FromColor(asset.skinColorColor) : null,
                IsHostile: asset.isHostile,
                IsNegative: asset.isNegative,
                IsDisease: asset.isDisease,
                IsLegendary: asset.isLegendary,
                ItemMoneyCost: asset.itemMoneyCost,
                MinLevel: asset.minLevel,
                ForceAppearIfInfiniteLifetime: asset.forceAppearIfInfiniteLifetime,
                OnlyApplyToLifeMode: SplitFlags(asset.onlyApplyToLifeMode),
                AiType: asset.aiType.ToString());
        }
        Diagnostics.AddRange(Refs.Diagnostics);
        Refs.Diagnostics.Clear();
    }

    // Helper methods (NullIfEmpty, BuildTooltipSnapshot, BuildModifySnapshots, SerializeAppliedColor, SplitFlags)
    // implemented straightforwardly using the typed fields. See decompile for field names.
}
```

- [ ] **Step 3: Tests**

```cs
[Fact]
public void ExtractsStatusEffectWithTooltipTemplateAndEffects()
{
    var asset = FakeStatusEffectAssetSource.Build(/* a status effect with one ModStatEffect */);
    var auditor = new EffectBindingAuditor();
    var extractor = new StatusEffectExtractor(new FakeStatusEffectAssetSource(new[] { asset }), auditor);
    var rows = extractor.Walk().ToList();
    Assert.Single(rows);
    Assert.NotEmpty(rows[0].Effects);
    Assert.Equal("ModStatEffect", rows[0].Effects[0].Kind);
}
```

- [ ] **Step 4: Run + commit**

```sh
git add mod/src/Entities/StatusEffect/IStatusEffectAssetSource.cs mod/src/Entities/StatusEffect/StatusEffectExtractor.cs mod-tests/StatusEffectExtractorTests.cs mod-tests/FakeStatusEffectAssetSource.cs
git commit -m "feat(mod): extract status-effect snapshots"
```

### Task 10.3: Mod walker registration + golden capture instrumentation

**Files:**

- Modify: extraction orchestrator (register the extractor + writes `status-effects.json`)
- Create: `mod/src/Entities/StatusEffect/StatusEffectGoldenCaptureCommand.cs`

The golden capture is a separate HotRepl command (`compendium.captureGoldens`) the controller invokes after extraction. It walks every `StatusEffectData` (and `SpellData`, `EnchantmentData`; Phases 11–12 extend) and writes `fixtures/golden/<patch>/<entity-type>/<ownerId>.json` files containing `{ patch, entityType, ownerId, level, lifetime, targetSelf, expected }`, where `expected` is the result of `StatusEffectData.GetTooltip(MinLevel, 0, true)` — i.e. the canonical patch-anchor capture.

- [ ] **Step 1: Implement the capture command**

```cs
// mod/src/Entities/StatusEffect/StatusEffectGoldenCaptureCommand.cs
using System.Collections.Generic;
using System.IO;
using Ardenfall;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.StatusEffect;

public sealed class StatusEffectGoldenCaptureCommand
{
    public sealed record CapturedSnapshot(string patch, string entityType, string ownerId, float level, float lifetime, bool targetSelf, string expected);

    public List<CapturedSnapshot> Capture(string patch, IStatusEffectAssetSource source)
    {
        var snapshots = new List<CapturedSnapshot>();
        foreach (var asset in source.EnumerateStatusEffects())
        {
            var lookup = BuiltLookupTable.Instance;
            if (lookup == null) break;
            var guid = lookup.GetGuid(asset);
            if (guid == null) continue;
            var level = asset.minLevel;
            var lifetime = 0f;
            var targetSelf = true;
            var expected = asset.GetTooltip(level, lifetime, targetSelf);
            snapshots.Add(new CapturedSnapshot(patch, "status-effect", guid, level, lifetime, targetSelf, expected));
        }
        return snapshots;
    }

    public void Write(string outputDir, IEnumerable<CapturedSnapshot> snapshots)
    {
        Directory.CreateDirectory(outputDir);
        foreach (var snap in snapshots)
        {
            var path = Path.Combine(outputDir, snap.entityType, snap.ownerId + ".json");
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            File.WriteAllText(path, JsonConvert.SerializeObject(snap, Formatting.Indented));
        }
    }
}
```

The controller (`controller/src/cli.ts`) gains a `--capture-goldens` flag that POSTs `compendium.captureGoldens` over HotRepl after extraction completes. Add the typed command to the controller's command list.

- [ ] **Step 2: Add a test that exercises the capture against synthetic assets**

```cs
[Fact]
public void CapturesEveryStatusEffectWithSchemaShape()
{
    var source = new FakeStatusEffectAssetSource(new[] { FakeStatusEffectAssetSource.WithGuid("fixture-restore-health", "Restore Health") });
    var command = new StatusEffectGoldenCaptureCommand();
    var snapshots = command.Capture("0.0.10.91-anchor", source);
    Assert.Single(snapshots);
    Assert.Equal("status-effect", snapshots[0].entityType);
}
```

- [ ] **Step 3: Commit**

```sh
git add mod/src/Entities/StatusEffect/StatusEffectGoldenCaptureCommand.cs mod-tests/StatusEffectGoldenCaptureCommandTests.cs controller/src/cli.ts
git commit -m "feat(mod): capture status-effect golden tooltips"
```

### Task 10.4: Pipeline descriptor + envelope schema + `effect_instances` DDL

**Files:**

- Create: `entities/status-effect/entity.json`
- Create: `pipeline/src/sql/status-effect-ddl.ts`
- Create: `pipeline/src/sql/effect-instances-ddl.ts`
- Modify: `schemas/snapshot.schema.json` (already extended in Phase 3.2 to admit the new entity ids — no further change unless `status-effects.json` needs entity-specific row validation; for Phase 10 we ship a separate schema below)
- Create: `schemas/status-effect-envelope.schema.json` (a per-entity envelope schema; admit deep `effects[].payload` as `additionalProperties: true` so different `effect_kind`s do not need a giant union here — Zod validates the kind-specific payload downstream)
- Modify: `pipeline/scripts/codegen-validators.ts` to register the new schema
- Modify: `pipeline/src/stages/load-snapshot.ts` to validate `envelopes["status-effect"]` against the new schema

```ts
// pipeline/src/sql/status-effect-ddl.ts
export const STATUS_EFFECT_DDL = `
CREATE TABLE status_effects (
  id                               TEXT PRIMARY KEY,
  status_effect_name               TEXT NOT NULL,
  character_name_modifier          TEXT,
  icon_hash                        TEXT,
  tooltip_template                 TEXT NOT NULL,
  tooltip_variables_json           TEXT NOT NULL,
  modify_status_effects_json       TEXT NOT NULL DEFAULT '[]',
  color_json                       TEXT NOT NULL,
  skin_color_asset_id              TEXT,
  skin_color_json                  TEXT,
  skin_color_color_json            TEXT,
  skin_color_importance            REAL NOT NULL DEFAULT 0,
  enable_skin_color                INTEGER NOT NULL DEFAULT 0,
  custom_skin_color_color          INTEGER NOT NULL DEFAULT 0,
  is_hostile                       INTEGER NOT NULL DEFAULT 0,
  is_negative                      INTEGER NOT NULL DEFAULT 0,
  is_disease                       INTEGER NOT NULL DEFAULT 0,
  is_legendary                     INTEGER NOT NULL DEFAULT 0,
  item_money_cost                  REAL NOT NULL DEFAULT 0,
  min_level                        INTEGER NOT NULL DEFAULT 1,
  force_appear_if_infinite_lifetime INTEGER NOT NULL DEFAULT 0,
  only_apply_to_life_mode_json     TEXT NOT NULL DEFAULT '[]',
  ai_type                          TEXT NOT NULL
);
`;
```

```ts
// pipeline/src/sql/effect-instances-ddl.ts
export const EFFECT_INSTANCES_DDL = `
CREATE TABLE effect_instances (
  effect_id      TEXT PRIMARY KEY,
  owner_type     TEXT NOT NULL,
  owner_id       TEXT NOT NULL,
  owner_scope    TEXT NOT NULL,
  effect_index   INTEGER NOT NULL,
  effect_kind    TEXT NOT NULL,
  payload_json   TEXT NOT NULL
);
CREATE INDEX idx_effect_instances_owner ON effect_instances (owner_type, owner_id, owner_scope, effect_index);
CREATE INDEX idx_effect_instances_kind  ON effect_instances (effect_kind);
`;
```

```json
// entities/status-effect/entity.json
{
  "$schema": "../../schemas/entity.schema.json",
  "id": "status-effect",
  "singularLabel": "Status effect",
  "pluralLabel": "Status effects",
  "routePath": "/status-effects",
  "canonicalTable": "status_effects",
  "presentationContext": { "renderContext": "status-effect-presentation-v1" },
  "fields": [
    { "name": "id", "type": "string", "from": "id", "missingPolicy": "fatal" },
    {
      "name": "statusEffectName",
      "type": "string",
      "from": "statusEffectName",
      "missingPolicy": "fatal"
    },
    { "name": "tooltip", "type": "json", "from": "tooltip", "missingPolicy": "fatal" },
    { "name": "effects", "type": "json", "from": "effects", "missingPolicy": "optional-empty" }
  ]
}
```

- [ ] **Step 1: Implement the DDL modules + descriptor + schema**
- [ ] **Step 2: Register validator + wire into `load-snapshot.ts`**
- [ ] **Step 3: Commit**

```sh
git add entities/status-effect/entity.json schemas/status-effect-envelope.schema.json pipeline/dist/validate-status-effect-envelope.mjs pipeline/dist/validate-status-effect-envelope.d.mts pipeline/src/sql/status-effect-ddl.ts pipeline/src/sql/effect-instances-ddl.ts pipeline/scripts/codegen-validators.ts pipeline/src/stages/load-snapshot.ts
git commit -m "feat(pipeline): add status-effect descriptor and DDL"
```

### Task 10.5: Pipeline canonicaliser + Zod payload validation

**Files:**

- Create: `pipeline/src/entities/status-effect/canonicaliser.ts`
- Test: `pipeline/test/status-effect-canonicaliser.test.ts`

The canonicaliser:

1. Inserts the entity row into `status_effects`.
2. Inserts each `effects[i]` into `effect_instances` with `owner_type='status-effect'`, `owner_scope='status-effect-effects'`.
3. Validates each `payload_json` against the corresponding Zod schema from `pipeline/src/composer/effect-kinds`. Unknown kinds emit a diagnostic into `pipeline_diagnostics` with `source='composer'`, `code='unknownEffectKind'`, `entityId=ownerId`.
4. Validates the audit against the registered schemas: for every `(effectKind, variableName)` in the `effect-bindings-audit.json`, if the kind has a schema but the schema does not declare the field, emit `unknownEffectBinding` fatal diagnostic.

The Zod-failure path is a diagnostic, not a hard throw, so a single unknown kind does not stall the whole pipeline; the audit-driven mismatch IS fatal so we never ship a tooltip we cannot deterministically render.

- [ ] **Step 1: Write the failing test**

```ts
// pipeline/test/status-effect-canonicaliser.test.ts
import { describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { STATUS_EFFECT_DDL } from "$pipeline/sql/status-effect-ddl";
import { EFFECT_INSTANCES_DDL } from "$pipeline/sql/effect-instances-ddl";
import { canonicaliseStatusEffects } from "$pipeline/entities/status-effect/canonicaliser";

describe("canonicaliseStatusEffects", () => {
  it("inserts status_effects row and effect_instances rows", () => {
    const db = new Database(":memory:");
    db.exec(STATUS_EFFECT_DDL + EFFECT_INSTANCES_DDL);
    canonicaliseStatusEffects(db, {
      entityId: "status-effect",
      schemaVersion: 1,
      rows: [
        {
          id: "fixture-restore-health",
          statusEffectName: "Restore Health",
          tooltip: {
            template: "Restores {0} {target} for {lifetime}.",
            variables: [
              {
                componentIndex: 0,
                variableName: "modification",
                type: "None",
                isPercentage: false,
                oneMinus: false,
                invert: false,
                absoluteValue: false,
                isInt: true,
                rountToTenths: false,
                multiplier: 1,
                add: 0,
              },
            ],
          },
          effects: [
            {
              kind: "ModStatEffect",
              payload: {
                stat: { kind: "lookupAsset", guid: "fixture-strength" },
                modification: { baseValue: 5, levelScale: 0 },
                addition: true,
              },
            },
          ],
          modifyStatusEffects: [],
          color: {
            color: { r: 1, g: 1, b: 1, a: 1 },
            applyToIcons: true,
            applyToParticles: true,
            applyToMeshRenderers: false,
          },
          skinColorAssetRef: null,
          skinColor: null,
          skinColorImportance: 0,
          enableSkinColor: false,
          customSkinColorColor: false,
          skinColorColor: null,
          isHostile: false,
          isNegative: false,
          isDisease: false,
          isLegendary: false,
          itemMoneyCost: 10,
          minLevel: 1,
          forceAppearIfInfiniteLifetime: false,
          onlyApplyToLifeMode: [],
          aiType: "Friend",
        },
      ],
      diagnostics: [],
    });
    const row = db
      .query<
        { id: string; status_effect_name: string },
        []
      >("SELECT id, status_effect_name FROM status_effects")
      .get();
    expect(row?.id).toBe("fixture-restore-health");
    const effect = db
      .query<
        { effect_kind: string; effect_index: number },
        []
      >("SELECT effect_kind, effect_index FROM effect_instances")
      .get();
    expect(effect?.effect_kind).toBe("ModStatEffect");
    expect(effect?.effect_index).toBe(0);
  });
});
```

- [ ] **Step 2: Implement**

```ts
// pipeline/src/entities/status-effect/canonicaliser.ts
import type { Database } from "bun:sqlite";
import type { SnapshotEnvelope } from "../../types.ts";
import { validateEffectPayload } from "../../composer/effect-kinds/index.ts";

interface StatusEffectRow {
  id: string;
  statusEffectName: string;
  characterNameModifier: string | null;
  iconRef: { hash?: string } | null;
  tooltip: { template: string; variables: unknown[] };
  effects: { kind: string; payload: unknown }[];
  modifyStatusEffects: unknown[];
  color: unknown;
  skinColorAssetRef: { hash?: string } | null;
  skinColor: unknown;
  skinColorColor: unknown;
  skinColorImportance: number;
  enableSkinColor: boolean;
  customSkinColorColor: boolean;
  isHostile: boolean;
  isNegative: boolean;
  isDisease: boolean;
  isLegendary: boolean;
  itemMoneyCost: number;
  minLevel: number;
  forceAppearIfInfiniteLifetime: boolean;
  onlyApplyToLifeMode: string[];
  aiType: string;
}

export function canonicaliseStatusEffects(db: Database, envelope: SnapshotEnvelope): void {
  const entityInsert = db.prepare(
    `INSERT INTO status_effects (
      id, status_effect_name, character_name_modifier, icon_hash,
      tooltip_template, tooltip_variables_json, modify_status_effects_json, color_json,
      skin_color_asset_id, skin_color_json, skin_color_color_json,
      skin_color_importance, enable_skin_color, custom_skin_color_color,
      is_hostile, is_negative, is_disease, is_legendary,
      item_money_cost, min_level, force_appear_if_infinite_lifetime,
      only_apply_to_life_mode_json, ai_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const effectInsert = db.prepare(
    `INSERT INTO effect_instances (effect_id, owner_type, owner_id, owner_scope, effect_index, effect_kind, payload_json)
     VALUES (?, 'status-effect', ?, 'status-effect-effects', ?, ?, ?)`,
  );

  const tx = db.transaction(() => {
    for (const row of envelope.rows as StatusEffectRow[]) {
      entityInsert.run(
        row.id,
        row.statusEffectName,
        row.characterNameModifier,
        row.iconRef?.hash ?? null,
        row.tooltip.template,
        JSON.stringify(row.tooltip.variables),
        JSON.stringify(row.modifyStatusEffects),
        JSON.stringify(row.color),
        row.skinColorAssetRef?.hash ?? null,
        row.skinColor ? JSON.stringify(row.skinColor) : null,
        row.skinColorColor ? JSON.stringify(row.skinColorColor) : null,
        row.skinColorImportance,
        row.enableSkinColor ? 1 : 0,
        row.customSkinColorColor ? 1 : 0,
        row.isHostile ? 1 : 0,
        row.isNegative ? 1 : 0,
        row.isDisease ? 1 : 0,
        row.isLegendary ? 1 : 0,
        row.itemMoneyCost,
        row.minLevel,
        row.forceAppearIfInfiniteLifetime ? 1 : 0,
        JSON.stringify(row.onlyApplyToLifeMode),
        row.aiType,
      );
      row.effects.forEach((effect, index) => {
        const validation = validateEffectPayload(effect.kind, effect.payload);
        // Diagnostics are appended by the caller via `auditEntityGraph` / `pipeline_diagnostics` insertion.
        effectInsert.run(
          `${row.id}:${index}:${effect.kind}`,
          row.id,
          index,
          effect.kind,
          JSON.stringify(validation.ok ? validation.data : effect.payload),
        );
      });
    }
  });
  tx();
}
```

- [ ] **Step 3: Run + commit**

Run: `bun test pipeline/test/status-effect-canonicaliser.test.ts`

```sh
git add pipeline/src/entities/status-effect/canonicaliser.ts pipeline/test/status-effect-canonicaliser.test.ts
git commit -m "feat(pipeline): canonicalise status-effect snapshots"
```

### Task 10.6: Composer port — `status-effect-tooltip.ts`

**Files:**

- Create: `pipeline/src/composer/status-effect-tooltip.ts`
- Test: `pipeline/test/composer/status-effect-tooltip.test.ts`

```ts
// pipeline/src/composer/status-effect-tooltip.ts
import type { MasterTooltipVocabulary } from "../types.ts";
import type { VariableBinding } from "./composer-context.ts";
import { applyColors, getValueFromField } from "./string-tooltip.ts";
import { applyColorCodes } from "./master-data.ts";

export interface StatusEffectSnapshot {
  id: string;
  statusEffectName: string;
  tooltip: { template: string; variables: VariableBinding[] };
  effects: { kind: string; payload: Record<string, unknown> }[];
  minLevel: number;
}

export interface ComposeStatusEffectInput {
  statusEffect: StatusEffectSnapshot;
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

export function composeStatusEffectTooltip(input: ComposeStatusEffectInput): string {
  const { statusEffect, vocabulary, recurseStatusEffect } = input;
  const level = Math.max(input.level, statusEffect.minLevel);
  const lifetime = input.lifetime;
  const targetSelf = input.targetSelf;
  let text = statusEffect.tooltip.template;
  statusEffect.tooltip.variables.forEach((variable, i) => {
    const effect = statusEffect.effects[variable.componentIndex];
    const value = effect
      ? getValueFromField({
          payload: effect.payload,
          variable,
          level,
          lifetime,
          targetSelf,
          vocabulary,
          recurseStatusEffect,
        })
      : "";
    text = text.replace(`{${i}}`, value);
  });
  text = text.replaceAll("{level}", level.toString());
  text = text.replaceAll("{lifetime}", `${lifetime} Seconds`);
  text = text.replaceAll("{target}", targetSelf ? "Self" : "Target");
  text = lifetime > 0 ? text.replace(/\[lif (.*?)\]/g, "$1") : text.replace(/\[lif (.*?)\]/g, "");
  text = applyColors(text, vocabulary);
  text = applyColorCodes(text, vocabulary);
  return text;
}
```

- [ ] **Step 1: Write tests covering the composer regression checklist from spec §9**

```ts
import { describe, expect, it } from "bun:test";
import { composeStatusEffectTooltip } from "$pipeline/composer/status-effect-tooltip";

describe("composeStatusEffectTooltip", () => {
  it("substitutes {0}, {level}, {lifetime}, {target} placeholders", () => {
    const out = composeStatusEffectTooltip({
      statusEffect: {
        id: "se",
        statusEffectName: "Restore Health",
        tooltip: {
          template: "Restores {0} {target} for {lifetime}.",
          variables: [
            {
              componentIndex: 0,
              variableName: "value",
              type: "None",
              isPercentage: false,
              oneMinus: false,
              invert: false,
              absoluteValue: false,
              isInt: true,
              rountToTenths: false,
              multiplier: 1,
              add: 0,
            },
          ],
        },
        effects: [{ kind: "ModStatEffect", payload: { value: 150 } }],
        minLevel: 1,
      },
      level: 1,
      lifetime: 3,
      targetSelf: true,
      vocabulary: SyntheticVocab,
    });
    expect(out).toContain("Restores 150 Self for 3 Seconds.");
  });

  it("respects minLevel floor", () => {
    const out = composeStatusEffectTooltip({
      statusEffect: {
        id: "se",
        statusEffectName: "X",
        tooltip: { template: "Level: {level}", variables: [] },
        effects: [],
        minLevel: 5,
      },
      level: 1,
      lifetime: 0,
      targetSelf: false,
      vocabulary: SyntheticVocab,
    });
    expect(out).toContain("Level: 5");
  });

  it("collapses `[lif ...]` segments when lifetime == 0", () => {
    const out = composeStatusEffectTooltip({
      statusEffect: {
        id: "se",
        statusEffectName: "X",
        tooltip: { template: "Restores [lif {lifetime}].", variables: [] },
        effects: [],
        minLevel: 1,
      },
      level: 1,
      lifetime: 0,
      targetSelf: false,
      vocabulary: SyntheticVocab,
    });
    expect(out).toBe("Restores .");
  });

  it("keeps `[lif ...]` body when lifetime > 0", () => {
    const out = composeStatusEffectTooltip({
      statusEffect: {
        id: "se",
        statusEffectName: "X",
        tooltip: { template: "Restores [lif {lifetime}].", variables: [] },
        effects: [],
        minLevel: 1,
      },
      level: 1,
      lifetime: 3,
      targetSelf: false,
      vocabulary: SyntheticVocab,
    });
    expect(out).toBe("Restores 3 Seconds.");
  });
});
```

- [ ] **Step 2: Run + commit**

```sh
git add pipeline/src/composer/status-effect-tooltip.ts pipeline/test/composer/status-effect-tooltip.test.ts
git commit -m "feat(pipeline): compose status-effect tooltip"
```

### Task 10.7: Read-model + composed-text persistence + golden-file tests

**Files:**

- Modify: `pipeline/src/stages/emit-read-models.ts` (add `emitStatusEffectReadModels`)
- Create: `pipeline/test/composer/status-effect-golden.test.ts`

The read-model emits `status_effect_overview_rows` + `status_effect_presentation_rows` + populates `entity_nodes` (slug + short_id). The `status_effect_presentation_rows.description_rich_text_json` carries the composer output (translated through `rich_text_v1` translator after composition) so the site never re-runs the composer.

Read-model DDL:

```sql
CREATE TABLE status_effect_overview_rows (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  icon_hash       TEXT,
  is_negative     INTEGER NOT NULL DEFAULT 0,
  is_disease      INTEGER NOT NULL DEFAULT 0,
  is_legendary    INTEGER NOT NULL DEFAULT 0,
  display_color   TEXT
);
CREATE TABLE status_effect_presentation_rows (
  id                          TEXT PRIMARY KEY,
  name                        TEXT NOT NULL,
  render_context              TEXT NOT NULL,
  icon_hash                   TEXT,
  display_color               TEXT,
  description_rich_text_json  TEXT NOT NULL,
  level_table_json            TEXT NOT NULL,
  effects_summary_json        TEXT NOT NULL,
  flags_json                  TEXT NOT NULL,
  diagnostics_json            TEXT NOT NULL DEFAULT '[]'
);
```

`level_table_json` is the composer's output rendered at `[minLevel, minLevel+1, minLevel+2, minLevel+5, minLevel+10]` — a few representative levels for the detail page. The 5-level table is cheap to compute and gives readers a "how does this scale?" view that the in-game tooltip doesn't easily expose.

`effects_summary_json` is structured atoms per effect: `[{ kind, displayLabel, key facts }]` for chip rendering.

- [ ] **Step 1: Implement `emitStatusEffectReadModels`**

The function loops over `status_effects`, runs `composeStatusEffectTooltip` at the chosen levels, persists JSON.

- [ ] **Step 2: Golden-file tests**

```ts
// pipeline/test/composer/status-effect-golden.test.ts
import { describe, expect, it } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { loadGolden, compareToGolden } from "$pipeline/composer/golden/snapshot";
import { composeStatusEffectTooltip } from "$pipeline/composer/status-effect-tooltip";
// load the synthetic vocab + a fixture status-effect ...

describe("status-effect golden parity", () => {
  const patch = "0.0.10.91-anchor";
  const dir = join("fixtures", "golden", patch, "status-effect");
  if (!existsSync(dir)) {
    it.skip("goldens not captured yet (run controller --capture-goldens)", () => {});
    return;
  }
  for (const file of readdirSync(dir)) {
    const ownerId = file.replace(/\.json$/, "");
    it(`composes ${ownerId} byte-exactly`, () => {
      const golden = loadGolden(patch, "status-effect", ownerId);
      const actual = composeStatusEffectTooltip(/* hydrate inputs from fixture snapshot */);
      const result = compareToGolden(actual, golden.expected);
      if (!result.ok) {
        throw new Error(`Composer diverged for ${ownerId}:\n${result.diff}`);
      }
    });
  }
});
```

Fixture goldens are committed under `fixtures/golden/0.0.10.91-anchor/status-effect/<fixture-id>.json` (use the synthetic fixture status-effects from Task 10.4 + their expected output). When the live capture runs against the real game (controller `--capture-goldens`), it writes its own goldens under the same path; commit those after capture.

- [ ] **Step 3: Commit**

```sh
git add pipeline/src/stages/emit-read-models.ts pipeline/test/composer/status-effect-golden.test.ts fixtures/golden/0.0.10.91-anchor/status-effect/
git commit -m "feat(pipeline): status-effect read model with composed text"
```

### Task 10.8: Site overview + detail pages

**Files:**

- Create: `site/src/routes/status-effects/+page.server.ts`, `+page.svelte`
- Create: `site/src/routes/status-effects/[slug]/+page.server.ts`, `+page.svelte`
- Create: `site/src/lib/components/status-effects/StatusEffectOverview.svelte`, `StatusEffectDetail.svelte`, `StatusEffectLevelTable.svelte`, `StatusEffectFlags.svelte`
- Modify: `site/src/lib/server/read-models.ts` (add `listStatusEffects`, `getStatusEffectPresentation`)

Apply the small-entity template's site-page pattern (Task 4.8) with these additions:

- The detail page renders `description_rich_text_json` via the existing `RichText` component (Slice 4).
- `StatusEffectLevelTable` shows the composed text at the 5 representative levels.
- `StatusEffectFlags` shows pill-style badges for `isNegative`, `isDisease`, `isLegendary`.
- Reverse relationship sections (items / spells / enchantments that apply this) come in Phase 15.

Commit: `feat(site): render status-effect pages`.

### Task 10.9: Phase 10 verification gate

- [ ] Run the standard phase gate.
- [ ] Confirm goldens for every fixture status-effect pass.
- [ ] Visit `/status-effects` and a representative detail page; confirm composed text matches the expected fixture output.
- [ ] Update coordinator phase index row 10 status to ✅.

---

[← Previous phase](09-composer-port.md) · [Next phase →](11-spell.md) · [Coordinator](../2026-05-20-items-presentation-closure.md)
