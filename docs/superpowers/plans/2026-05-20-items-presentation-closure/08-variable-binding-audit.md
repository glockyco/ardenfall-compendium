[← Previous phase](07-effect-serializer.md) · [Next phase →](09-composer-port.md) · [Coordinator](../2026-05-20-items-presentation-closure.md)

# Phase 8: Variable-binding audit (mod)

**Spec coverage:** §7.7.

**Why eighth:** the composer port (Phase 9) needs Zod schemas for the `(effectKind, variableName)` pairs that any `StatusEffectData.tooltip.variables`, `SpellTooltip.variables`, or `EnchantmentTooltip.variables` template references. The asset templates pick variable names by string at runtime — there is no static list. The only honest way to know which fields matter is to walk every concrete asset of each type and harvest the `(componentIndex → effect kind, variableName)` tuples. Phase 8 builds that walker, emits `effect-bindings-audit.json` alongside the snapshot, and gives the pipeline a contract to validate against.

**Outcome:** every extraction run produces `effect-bindings-audit.json` listing, per owner type (`status-effect` / `spell` / `enchantment`), every `(effectKind, variableName)` pair that any asset's tooltip variables list resolves to. The pipeline raises an `unknownEffectBinding` fatal diagnostic if a Zod schema in Phase 9 fails to cover a pair the audit knows about. The audit re-runs per patch upgrade as a regression detector.

## Audit data shape

```json
{
  "schemaVersion": 1,
  "owners": {
    "status-effect": [
      {
        "ownerId": "fixture-restore-health",
        "templateOwner": "StatusEffectTooltip",
        "variables": [
          {
            "componentIndex": 0,
            "variableName": "modification",
            "effectKind": "ModStatEffect",
            "type": "Percentage",
            "isPercentage": false,
            "oneMinus": false,
            "invert": false,
            "absoluteValue": false,
            "isInt": false,
            "rountToTenths": true,
            "multiplier": 1.0,
            "add": 0.0
          }
        ]
      }
    ],
    "spell": [...],
    "enchantment": [...]
  }
}
```

Owner sub-blocks are sorted by `ownerId` so diffs across patches are stable.

## Tasks

### Task 8.1: Audit DTOs

**Files:**

- Create: `mod/src/Effects/Audit/EffectBindingAuditSnapshot.cs`

```cs
using System.Collections.Generic;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Effects.Audit;

public sealed record EffectBindingAuditSnapshot(
    [property: JsonProperty("schemaVersion")] int SchemaVersion,
    [property: JsonProperty("owners")] EffectBindingOwners Owners);

public sealed record EffectBindingOwners(
    [property: JsonProperty("status-effect")] List<EffectBindingOwner> StatusEffect,
    [property: JsonProperty("spell")] List<EffectBindingOwner> Spell,
    [property: JsonProperty("enchantment")] List<EffectBindingOwner> Enchantment);

public sealed record EffectBindingOwner(
    [property: JsonProperty("ownerId")] string OwnerId,
    [property: JsonProperty("templateOwner")] string TemplateOwner,
    [property: JsonProperty("variables")] List<EffectBindingVariable> Variables);

public sealed record EffectBindingVariable(
    [property: JsonProperty("componentIndex")] int ComponentIndex,
    [property: JsonProperty("variableName")] string VariableName,
    [property: JsonProperty("effectKind")] string EffectKind,
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

Note: the `RountToTenths` field name preserves the typo from the game (`StringTooltip.TooltipVarBase.rountToTenths` at `.decompiled/.../StringTooltip.cs:27`). The mod and pipeline both honour the source-of-truth spelling.

- [ ] **Step 1: Implement the DTOs**
- [ ] **Step 2: Test record serialisation**

```cs
[Fact]
public void AuditSnapshotSerializesToExpectedShape()
{
    var snap = new EffectBindingAuditSnapshot(1, new EffectBindingOwners(new(), new(), new()));
    var json = Newtonsoft.Json.JsonConvert.SerializeObject(snap);
    Assert.Contains("\"schemaVersion\":1", json);
    Assert.Contains("\"owners\":{", json);
}
```

- [ ] **Step 3: Commit**

```sh
git add mod/src/Effects/Audit/EffectBindingAuditSnapshot.cs mod-tests/EffectBindingAuditSnapshotTests.cs
git commit -m "feat(mod): effect binding audit DTOs"
```

### Task 8.2: Auditor walker

**Files:**

- Create: `mod/src/Effects/Audit/EffectBindingAuditor.cs`
- Test: `mod-tests/EffectBindingAuditorTests.cs`

The auditor takes three asset sources (`IStatusEffectAssetSource`, `ISpellAssetSource`, `IEnchantmentAssetSource` — added in Phases 10–12; for Phase 8, use the existing `BuiltLookupTable.GetAssetsOfType<T>()` directly) and walks every asset, harvesting the tooltip variables list.

- [ ] **Step 1: Write the failing test**

```cs
// mod-tests/EffectBindingAuditorTests.cs
using ArdenfallCompendium.Effects.Audit;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class EffectBindingAuditorTests
{
    [Fact]
    public void CapturesStatusEffectTooltipVariables()
    {
        var asset = new FakeStatusEffectData(
            id: "fixture-restore-health",
            tooltipTemplate: "Restores {0} {target} for {lifetime}.",
            variables: new[]
            {
                FakeTooltipVar.Build(componentIndex: 0, variableName: "totalDeltaTooltip", type: "None", rountToTenths: false, isInt: true),
            },
            effects: new object[] { new Ardenfall.ModPerSecondEffect() });
        var auditor = new EffectBindingAuditor();
        auditor.AuditStatusEffect(asset);
        var snap = auditor.Build();
        var owner = Assert.Single(snap.Owners.StatusEffect);
        Assert.Equal("fixture-restore-health", owner.OwnerId);
        var variable = Assert.Single(owner.Variables);
        Assert.Equal("totalDeltaTooltip", variable.VariableName);
        Assert.Equal("ModPerSecondEffect", variable.EffectKind);
        Assert.True(variable.IsInt);
    }
}
```

`FakeStatusEffectData` + `FakeTooltipVar` are hand-written test doubles since `StatusEffectData` requires Unity context to instantiate. Add them under `mod-tests/`.

- [ ] **Step 2: Implement the auditor**

```cs
// mod/src/Effects/Audit/EffectBindingAuditor.cs
using System.Collections.Generic;
using Ardenfall;

namespace ArdenfallCompendium.Effects.Audit;

public sealed class EffectBindingAuditor
{
    private readonly List<EffectBindingOwner> _statusEffectOwners = new();
    private readonly List<EffectBindingOwner> _spellOwners = new();
    private readonly List<EffectBindingOwner> _enchantmentOwners = new();

    public void AuditStatusEffect(IStatusEffectAuditSource asset)
    {
        var variables = new List<EffectBindingVariable>();
        for (int i = 0; i < asset.TooltipVariables.Count; i++)
        {
            var v = asset.TooltipVariables[i];
            var effectKind = (asset.Effects.Count > v.ComponentIndex && asset.Effects[v.ComponentIndex] != null)
                ? asset.Effects[v.ComponentIndex]!.GetType().Name
                : "unknown";
            variables.Add(new EffectBindingVariable(
                v.ComponentIndex, v.VariableName, effectKind,
                v.Type, v.IsPercentage, v.OneMinus, v.Invert, v.AbsoluteValue,
                v.IsInt, v.RountToTenths, v.Multiplier, v.Add));
        }
        _statusEffectOwners.Add(new EffectBindingOwner(asset.OwnerId, "StatusEffectTooltip", variables));
    }

    // AuditSpell, AuditEnchantment follow the same pattern, walking spell.tooltip.variables /
    // spell.subSpells[i].effects[k] (with subspell-aware componentIndex) and enchantment.tooltip.variables.

    public EffectBindingAuditSnapshot Build()
    {
        _statusEffectOwners.Sort((a, b) => string.CompareOrdinal(a.OwnerId, b.OwnerId));
        _spellOwners.Sort((a, b) => string.CompareOrdinal(a.OwnerId, b.OwnerId));
        _enchantmentOwners.Sort((a, b) => string.CompareOrdinal(a.OwnerId, b.OwnerId));
        return new EffectBindingAuditSnapshot(
            SchemaVersion: 1,
            Owners: new EffectBindingOwners(_statusEffectOwners, _spellOwners, _enchantmentOwners));
    }
}

public interface IStatusEffectAuditSource
{
    string OwnerId { get; }
    IReadOnlyList<AuditableTooltipVar> TooltipVariables { get; }
    IReadOnlyList<object?> Effects { get; }
}

public sealed record AuditableTooltipVar(
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
    float Add);
```

Real adapters for `StatusEffectData`, `SpellData`, `EnchantmentData` land in Phases 10–12; each implements `IStatusEffectAuditSource` (or the parallel interfaces for spells / enchantments).

- [ ] **Step 3: Run + commit**

Run: `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --filter EffectBindingAuditorTests`

```sh
git add mod/src/Effects/Audit/EffectBindingAuditor.cs mod-tests/EffectBindingAuditorTests.cs mod-tests/FakeStatusEffectData.cs mod-tests/FakeTooltipVar.cs
git commit -m "feat(mod): effect binding auditor"
```

### Task 8.3: Emit `effect-bindings-audit.json` alongside the snapshot

**Files:**

- Modify: the mod's extraction orchestrator (same file you touched in Task 4.3 / 5.3 / 6.2) to invoke the auditor and write the artifact.

- [ ] **Step 1: Add the audit emission**

After every entity walker runs, before snapshot finalisation, build the auditor by passing every `StatusEffectData`, `SpellData`, `EnchantmentData` asset through it. Write the resulting `EffectBindingAuditSnapshot` to `<snapshotDir>/effect-bindings-audit.json` via Newtonsoft.

Note: at Phase 8 this writes an audit with empty owners (the three asset extractors don't exist yet). The audit becomes meaningful starting Phase 10.

- [ ] **Step 2: Add the fixture audit file**

`fixtures/synthetic/snapshot/effect-bindings-audit.json`:

```json
{
  "schemaVersion": 1,
  "owners": {
    "status-effect": [],
    "spell": [],
    "enchantment": []
  }
}
```

Refresh fixture hashes.

- [ ] **Step 3: Commit**

```sh
git add mod/src/<orchestrator>.cs fixtures/synthetic/snapshot/effect-bindings-audit.json fixtures/synthetic/snapshot/manifest.json fixtures/synthetic/manifest.json
git commit -m "feat(mod): emit effect bindings audit artifact"
```

### Task 8.4: Pipeline ingestion of the audit + schema

**Files:**

- Create: `schemas/effect-bindings-audit.schema.json`
- Modify: `pipeline/scripts/codegen-validators.ts` (register schema)
- Modify: `pipeline/src/stages/load-snapshot.ts` (load + validate the audit; expose on `LoadSnapshotOutput.effectBindingsAudit`)
- Test: `pipeline/test/effect-bindings-audit.test.ts`

- [ ] **Step 1: Write the JSON schema**

Mirror the DTO shape with `additionalProperties: false` everywhere.

- [ ] **Step 2: Wire the codegen**

Add `{ source: "schemas/effect-bindings-audit.schema.json", output: "dist/validate-effect-bindings-audit.mjs", typeName: "EffectBindingsAudit" }` to the codegen list.

Run: `bun run codegen:validators`.

- [ ] **Step 3: Load + validate in `load-snapshot.ts`**

```ts
// inside loadSnapshot.run, after master-tooltip handling
const auditPath = join(dir, "effect-bindings-audit.json");
let effectBindingsAudit: EffectBindingsAudit | undefined;
if (existsSync(auditPath)) {
  const raw = JSON.parse(readFileSync(auditPath, "utf8")) as unknown;
  if (!validateEffectBindingsAudit(raw)) {
    const detail = (validateEffectBindingsAudit.errors ?? [])
      .map((e) => `${auditPath}#${e.instancePath} — ${e.message}`)
      .join("\n");
    throw new Error(`invalid effect bindings audit at ${auditPath}:\n${detail}`);
  }
  effectBindingsAudit = raw as EffectBindingsAudit;
}
```

Expose `effectBindingsAudit` on `LoadSnapshotOutput`; types under `pipeline/src/types.ts`.

- [ ] **Step 4: Write the failing test**

```ts
it("loads the effect bindings audit when present", async () => {
  const out = await loadSnapshot.run({}, ctx);
  expect(out.effectBindingsAudit?.schemaVersion).toBe(1);
});
```

- [ ] **Step 5: Run + commit**

Run: `bun test pipeline/test/effect-bindings-audit.test.ts`

```sh
git add schemas/effect-bindings-audit.schema.json pipeline/dist/validate-effect-bindings-audit.mjs pipeline/dist/validate-effect-bindings-audit.d.mts pipeline/scripts/codegen-validators.ts pipeline/src/stages/load-snapshot.ts pipeline/src/types.ts pipeline/test/effect-bindings-audit.test.ts
git commit -m "feat(pipeline): ingest effect bindings audit"
```

### Task 8.5: Phase 8 verification gate

- [ ] Run the standard phase gate.
- [ ] Confirm the fixture's `effect-bindings-audit.json` validates and round-trips.
- [ ] Update coordinator phase index row 8 status to ✅.

---

[← Previous phase](07-effect-serializer.md) · [Next phase →](09-composer-port.md) · [Coordinator](../2026-05-20-items-presentation-closure.md)
