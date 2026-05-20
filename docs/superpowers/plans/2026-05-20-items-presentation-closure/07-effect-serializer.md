[← Previous phase](06-item-tag.md) · [Next phase →](08-variable-binding-audit.md) · [Coordinator](../2026-05-20-items-presentation-closure.md)

# Phase 7: Generic effect serializer (mod)

**Spec coverage:** §4.4, §6.6.

**Why seventh:** before we can extract any of `StatusEffectData`, `SpellData`, or `EnchantmentData`, we need a single serializer that handles their polymorphic `Effect` / `SpellEffect` / `EnchantmentEffect` payloads. Hand-writing ~60 per-subclass serializers is wasteful; pure-reflection drags in `GameObject` / audio / FX / AI fields. Phase 7 builds the one serializer Phases 10–12 share, with explicit allow-list handling for wrapper types and explicit deny-list of leaf-only types. The serializer is a pure C# library exercisable from xUnit; Phase 8 sweeps the live asset graph through it.

**Outcome:** `EffectSerializer.Serialize(object effect, RefResolver refs, string ownerId) → EffectInstanceSnapshot` that produces a deterministic `{ kind, payload: JObject }` for any concrete `Effect` / `SpellEffect` / `EnchantmentEffect` instance, with:

- typed handlers for `LeveledFloat`, `LeveledInt`, `LeveledStatusEffect`, `LeveledLeveledStatusEffect`, `CharacterModFloat`, `CharacterModInt`, `AppliedColor`, `StatType`, `StatusEffectData`, `EnchantmentData`, `SpellData`, `ItemData`, `ItemFilter`, `DialogStatementModifier`, `FlowGraph`, `DamageType`, primitives (float, int, bool, string), enums, lists, arrays.
- deny-list of leaf types whose extraction adds no tooltip / page value: `UnityEngine.GameObject`, `UnityEngine.Sprite`, `UnityEngine.Texture`, `UnityEngine.Material`, `UnityEngine.MeshFilter`, `UnityEngine.ParticleSystem`, `UnityEngine.Camera`, any `UnityEngine.MonoBehaviour` not listed in the allow-list, `Ardenfall.ArdenAudioClip`, `Ardenfall.ArdenAudioClipList`, `Ardenfall.ArdenAudioFilter`, `Ardenfall.CameraRotateKick`, `Ardenfall.VisualEffect`, `Ardenfall.ProjectileSettings` (already captured as a sibling DTO; not reachable from `Effect` directly), `Ardenfall.MaterialSound`, `Ardenfall.RangedItemAIBehavior`, `Ardenfall.MeleeItemAIBehavior`.
- diagnostics on every unrecognised type (`unknownEffectFieldType`) so the pipeline never silently drops data.

## Architecture

The serializer is a single class `mod/src/Effects/Serialization/EffectSerializer.cs` with:

```cs
public sealed record EffectInstanceSnapshot(string Kind, JObject Payload, List<Diagnostic> Diagnostics);

public sealed class EffectSerializer
{
    public EffectInstanceSnapshot Serialize(object effect, RefResolver refs, string ownerId, string ownerScope, int effectIndex);
}
```

Internally:

1. The `Kind` is `effect.GetType().Name` — drop the assembly-qualified prefix.
2. Reflect on public instance fields and properties of the effect type (no inherited members unless the base type is `Effect`/`SpellEffect`/`EnchantmentEffect`).
3. For each member, dispatch by the static `Type`:
   - **Primitives** (float/int/bool/string) → emit verbatim.
   - **Enums** → emit `ToString()`.
   - **Lists / arrays of T** → recurse into each element with `T`'s dispatcher.
   - **Allow-list wrappers** (the ~10 known wrapper types) → emit via their dedicated handler.
   - **Refs** (`UnityEngine.Object` subclasses we care about — `StatType`, `StatusEffectData`, `SpellData`, `EnchantmentData`, `ItemData`) → resolve via `RefResolver` and emit as a JSON ref object.
   - **Deny-list leaf types** → emit `null` (no diagnostic — these are intentionally dropped).
   - **Anything else** → emit `null` + a `unknownEffectFieldType` diagnostic.

Handlers register themselves at construction; each handler is a small `(object value, JsonContext ctx) → JToken` function.

## Tasks

### Task 7.1: Wrapper-type DTOs

The serializer's typed outputs are stable C# records that downstream code (audit pass, fixture builders) can consume.

**Files:**

- Create: `mod/src/Effects/Serialization/EffectWrapperSnapshots.cs`
- Test: `mod-tests/EffectWrapperSnapshotsTests.cs`

- [ ] **Step 1: Implement the wrapper DTOs**

```cs
// mod/src/Effects/Serialization/EffectWrapperSnapshots.cs
using ArdenfallCompendium.Assets;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Effects.Serialization;

public sealed record LeveledFloatSnapshot(
    [property: JsonProperty("baseValue")] float BaseValue,
    [property: JsonProperty("levelScale")] float LevelScale);

public sealed record LeveledIntSnapshot(
    [property: JsonProperty("baseValue")] int BaseValue,
    [property: JsonProperty("levelScale")] int LevelScale);

public sealed record LeveledStatusEffectSerializedSnapshot(
    [property: JsonProperty("statusEffectRef")] object? StatusEffectRef,
    [property: JsonProperty("level")] float Level,
    [property: JsonProperty("lifetime")] float Lifetime,
    [property: JsonProperty("stackMode")] StackModeSerializedSnapshot? StackMode);

public sealed record LeveledLeveledStatusEffectSerializedSnapshot(
    [property: JsonProperty("statusEffectRef")] object? StatusEffectRef,
    [property: JsonProperty("level")] LeveledFloatSnapshot? Level,
    [property: JsonProperty("lifetime")] LeveledFloatSnapshot? Lifetime,
    [property: JsonProperty("stackMode")] StackModeSerializedSnapshot? StackMode);

public sealed record StackModeSerializedSnapshot(
    [property: JsonProperty("type")] string Type,
    [property: JsonProperty("addLevel")] float AddLevel,
    [property: JsonProperty("maxLevel")] float MaxLevel);

public sealed record CharacterModFloatSnapshot(
    [property: JsonProperty("value")] float Value,
    [property: JsonProperty("isPercentage")] bool IsPercentage,
    [property: JsonProperty("isMultiplier")] bool IsMultiplier);

public sealed record CharacterModIntSnapshot(
    [property: JsonProperty("value")] int Value,
    [property: JsonProperty("isPercentage")] bool IsPercentage,
    [property: JsonProperty("isMultiplier")] bool IsMultiplier);

public sealed record AppliedColorSerializedSnapshot(
    [property: JsonProperty("color")] AssetColorSnapshot Color,
    [property: JsonProperty("applyToIcons")] bool ApplyToIcons,
    [property: JsonProperty("applyToParticles")] bool ApplyToParticles,
    [property: JsonProperty("applyToMeshRenderers")] bool ApplyToMeshRenderers);
```

(Field names like `IsMultiplier` on `CharacterModFloatSnapshot` come from the game's `GeneralCharacterModEffect.CharacterModFloat` — confirm against `.decompiled/.../GeneralCharacterModEffect.cs`.)

- [ ] **Step 2: Test the DTOs**

```cs
// mod-tests/EffectWrapperSnapshotsTests.cs
using ArdenfallCompendium.Assets;
using ArdenfallCompendium.Effects.Serialization;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class EffectWrapperSnapshotsTests
{
    [Fact]
    public void LeveledFloatSnapshotRoundTrips()
    {
        var snap = new LeveledFloatSnapshot(BaseValue: 5f, LevelScale: 2.5f);
        var json = Newtonsoft.Json.JsonConvert.SerializeObject(snap);
        Assert.Contains("\"baseValue\":5", json);
        Assert.Contains("\"levelScale\":2.5", json);
    }
}
```

- [ ] **Step 3: Run tests + commit**

Run: `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --filter EffectWrapperSnapshotsTests`

```sh
git add mod/src/Effects/Serialization/EffectWrapperSnapshots.cs mod-tests/EffectWrapperSnapshotsTests.cs
git commit -m "feat(mod): typed effect wrapper DTOs"
```

### Task 7.2: Type dispatcher + handler registry

**Files:**

- Create: `mod/src/Effects/Serialization/EffectTypeDispatcher.cs`
- Test: `mod-tests/EffectTypeDispatcherTests.cs`

- [ ] **Step 1: Write the failing test**

```cs
// mod-tests/EffectTypeDispatcherTests.cs
using System;
using System.Collections.Generic;
using ArdenfallCompendium.Effects.Serialization;
using Newtonsoft.Json.Linq;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class EffectTypeDispatcherTests
{
    [Fact]
    public void PrimitivesEmitVerbatim()
    {
        var dispatcher = EffectTypeDispatcher.Default();
        Assert.Equal(new JValue(5f), dispatcher.Convert(5f, typeof(float), out _));
        Assert.Equal(new JValue(true), dispatcher.Convert(true, typeof(bool), out _));
        Assert.Equal(new JValue("hello"), dispatcher.Convert("hello", typeof(string), out _));
    }

    [Fact]
    public void EnumEmitsToString()
    {
        var dispatcher = EffectTypeDispatcher.Default();
        var token = dispatcher.Convert(DayOfWeek.Wednesday, typeof(DayOfWeek), out _);
        Assert.Equal(new JValue("Wednesday"), token);
    }

    [Fact]
    public void ListRecursesElementType()
    {
        var dispatcher = EffectTypeDispatcher.Default();
        var token = dispatcher.Convert(new List<int> { 1, 2, 3 }, typeof(List<int>), out _);
        Assert.True(token is JArray);
        Assert.Equal(3, ((JArray)token!).Count);
    }

    [Fact]
    public void UnknownTypeEmitsNullPlusDiagnostic()
    {
        var dispatcher = EffectTypeDispatcher.Default();
        var token = dispatcher.Convert(new System.Random(), typeof(System.Random), out var diagnostics);
        Assert.True(token is JValue v && v.Type == JTokenType.Null);
        Assert.Contains(diagnostics, d => d.Code == "unknownEffectFieldType");
    }
}
```

- [ ] **Step 2: Implement the dispatcher**

```cs
// mod/src/Effects/Serialization/EffectTypeDispatcher.cs
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using ArdenfallCompendium.Assets;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Walker;
using Newtonsoft.Json.Linq;

namespace ArdenfallCompendium.Effects.Serialization;

public sealed class EffectTypeDispatcher
{
    private readonly HashSet<Type> _denyTypes;
    private readonly Dictionary<Type, Func<object, EffectTypeDispatcher, List<Diagnostic>, JToken>> _allowExact;
    private readonly List<Func<Type, bool>> _denyPredicates;

    private EffectTypeDispatcher(
        Dictionary<Type, Func<object, EffectTypeDispatcher, List<Diagnostic>, JToken>> allowExact,
        HashSet<Type> denyTypes,
        List<Func<Type, bool>> denyPredicates)
    {
        _allowExact = allowExact;
        _denyTypes = denyTypes;
        _denyPredicates = denyPredicates;
    }

    public static EffectTypeDispatcher Default()
    {
        var allow = new Dictionary<Type, Func<object, EffectTypeDispatcher, List<Diagnostic>, JToken>>();
        var deny = new HashSet<Type>
        {
            // Unity built-ins that have no tooltip / public-page value.
            typeof(UnityEngine.GameObject),
            typeof(UnityEngine.Sprite),
            typeof(UnityEngine.Texture),
            typeof(UnityEngine.Texture2D),
            typeof(UnityEngine.Material),
            typeof(UnityEngine.AudioClip),
            typeof(UnityEngine.Mesh),
            typeof(UnityEngine.MeshFilter),
            typeof(UnityEngine.ParticleSystem),
            typeof(UnityEngine.Camera),
        };
        var denyPredicates = new List<Func<Type, bool>>
        {
            // Any Ardenfall audio / camera / FX type.
            t => t.FullName?.StartsWith("Ardenfall.ArdenAudio") == true,
            t => t.FullName == "Ardenfall.CameraRotateKick",
            t => t.FullName == "Ardenfall.VisualEffect",
            t => t.FullName == "Ardenfall.MaterialSound",
            t => t.FullName?.EndsWith("AIBehavior") == true,
        };
        return new EffectTypeDispatcher(allow, deny, denyPredicates);
    }

    public JToken Convert(object? value, Type staticType, out List<Diagnostic> diagnostics)
    {
        diagnostics = new List<Diagnostic>();
        return ConvertInternal(value, staticType, diagnostics);
    }

    internal JToken ConvertInternal(object? value, Type staticType, List<Diagnostic> diagnostics)
    {
        if (value is null) return JValue.CreateNull();
        var runtimeType = value.GetType();
        if (_allowExact.TryGetValue(runtimeType, out var handler)) return handler(value, this, diagnostics);
        if (_denyTypes.Contains(runtimeType) || _denyPredicates.Any(p => p(runtimeType))) return JValue.CreateNull();
        if (runtimeType.IsEnum) return new JValue(value.ToString());
        if (value is string s) return new JValue(s);
        if (value is bool b) return new JValue(b);
        if (value is float f) return new JValue(f);
        if (value is double d) return new JValue(d);
        if (value is int i) return new JValue(i);
        if (value is long l) return new JValue(l);
        if (value is IEnumerable enumerable)
        {
            var element = GetElementType(staticType);
            var array = new JArray();
            foreach (var item in enumerable)
            {
                array.Add(ConvertInternal(item, element ?? item?.GetType() ?? typeof(object), diagnostics));
            }
            return array;
        }
        // Unknown — emit null + diagnostic.
        diagnostics.Add(new Diagnostic
        {
            Severity = "diagnostic",
            Code = "unknownEffectFieldType",
            Field = staticType.FullName ?? staticType.Name,
            Message = $"EffectTypeDispatcher has no handler for type {runtimeType.FullName}",
        });
        return JValue.CreateNull();
    }

    public void Register<T>(Func<T, EffectTypeDispatcher, List<Diagnostic>, JToken> handler)
    {
        _allowExact[typeof(T)] = (value, disp, diag) => handler((T)value, disp, diag);
    }

    private static Type? GetElementType(Type listType)
    {
        if (listType.IsArray) return listType.GetElementType();
        if (listType.IsGenericType)
        {
            var def = listType.GetGenericTypeDefinition();
            if (def == typeof(List<>) || def == typeof(IEnumerable<>) || def == typeof(IList<>))
            {
                return listType.GetGenericArguments()[0];
            }
        }
        return null;
    }
}
```

- [ ] **Step 3: Run + commit**

Run: `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --filter EffectTypeDispatcherTests`

```sh
git add mod/src/Effects/Serialization/EffectTypeDispatcher.cs mod-tests/EffectTypeDispatcherTests.cs
git commit -m "feat(mod): effect type dispatcher core"
```

### Task 7.3: Register allow-list handlers for Ardenfall wrapper types

**Files:**

- Create: `mod/src/Effects/Serialization/EffectAllowListHandlers.cs`
- Test: `mod-tests/EffectAllowListHandlersTests.cs`

Each handler is a small function that maps a runtime wrapper to its DTO + emits a JObject.

- [ ] **Step 1: Implement the registrations**

```cs
// mod/src/Effects/Serialization/EffectAllowListHandlers.cs
using System;
using System.Collections.Generic;
using Ardenfall;
using Ardenfall.Item;
using ArdenfallCompendium.Assets;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Walker;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace ArdenfallCompendium.Effects.Serialization;

public static class EffectAllowListHandlers
{
    public static void RegisterAll(EffectTypeDispatcher dispatcher, RefResolver refs, string ownerId)
    {
        dispatcher.Register<LeveledFloat>((value, disp, diag) =>
            JObject.FromObject(new LeveledFloatSnapshot(value.BaseValue, value.LevelScale)));

        dispatcher.Register<LeveledInt>((value, disp, diag) =>
            JObject.FromObject(new LeveledIntSnapshot(value.BaseValue, value.LevelScale)));

        dispatcher.Register<LeveledStatusEffect>((value, disp, diag) =>
        {
            var snap = new LeveledStatusEffectSerializedSnapshot(
                StatusEffectRef: refs.ResolveAsset(value.StatusEffect, "statusEffectRef", ownerId, MissingPolicy.Diagnostic, "Effect.LeveledStatusEffect.StatusEffect"),
                Level: value.Level,
                Lifetime: value.Lifetime,
                StackMode: value.StackMode == null
                    ? null
                    : new StackModeSerializedSnapshot(value.StackMode.type.ToString(), value.StackMode.addLevel, value.StackMode.maxLevel));
            return JObject.FromObject(snap);
        });

        dispatcher.Register<LeveledLeveledStatusEffect>((value, disp, diag) =>
        {
            var snap = new LeveledLeveledStatusEffectSerializedSnapshot(
                StatusEffectRef: refs.ResolveAsset(value.statusEffect, "statusEffectRef", ownerId, MissingPolicy.Diagnostic, "Effect.LeveledLeveledStatusEffect.StatusEffect"),
                Level: new LeveledFloatSnapshot(value.level.BaseValue, value.level.LevelScale),
                Lifetime: new LeveledFloatSnapshot(value.lifetime.BaseValue, value.lifetime.LevelScale),
                StackMode: value.stackMode == null
                    ? null
                    : new StackModeSerializedSnapshot(value.stackMode.type.ToString(), value.stackMode.addLevel, value.stackMode.maxLevel));
            return JObject.FromObject(snap);
        });

        dispatcher.Register<GeneralCharacterModEffect.CharacterModFloat>((value, disp, diag) =>
            JObject.FromObject(new CharacterModFloatSnapshot(value.value, value.isPercentage, value.isMultiplier)));

        dispatcher.Register<GeneralCharacterModEffect.CharacterModInt>((value, disp, diag) =>
            JObject.FromObject(new CharacterModIntSnapshot(value.value, value.isPercentage, value.isMultiplier)));

        dispatcher.Register<AppliedColor>((value, disp, diag) =>
            JObject.FromObject(new AppliedColorSerializedSnapshot(
                AssetColorSnapshot.FromColor(value.color),
                value.applyToIcons,
                value.applyToParticles,
                value.applyToMeshRenderers)));

        dispatcher.Register<StatType>((value, disp, diag) =>
            JToken.FromObject(refs.ResolveAsset(value, "statTypeRef", ownerId, MissingPolicy.Diagnostic, "Effect.StatType") ?? (object)JValue.CreateNull()));

        dispatcher.Register<StatusEffectData>((value, disp, diag) =>
            JToken.FromObject(refs.ResolveAsset(value, "statusEffectRef", ownerId, MissingPolicy.Diagnostic, "Effect.StatusEffectData") ?? (object)JValue.CreateNull()));

        dispatcher.Register<SpellData>((value, disp, diag) =>
            JToken.FromObject(refs.ResolveAsset(value, "spellRef", ownerId, MissingPolicy.Diagnostic, "Effect.SpellData") ?? (object)JValue.CreateNull()));

        dispatcher.Register<EnchantmentData>((value, disp, diag) =>
            JToken.FromObject(refs.ResolveAsset(value, "enchantmentRef", ownerId, MissingPolicy.Diagnostic, "Effect.EnchantmentData") ?? (object)JValue.CreateNull()));

        dispatcher.Register<ItemData>((value, disp, diag) =>
            JToken.FromObject(refs.ResolveAsset(value, "itemRef", ownerId, MissingPolicy.Diagnostic, "Effect.ItemData") ?? (object)JValue.CreateNull()));
    }
}
```

`ItemFilter`, `DialogStatementModifier`, `FlowGraph`, `DamageType` are deferred — `DamageType` is an enum (auto-handled by the dispatcher), the others land as `null` + `unknownEffectFieldType` diagnostic for now. The audit pass in Phase 8 will catalogue any concrete subclass field whose runtime value triggers this diagnostic, and Phase 10's status-effect emission step extends the allow-list to cover what the live data actually carries.

- [ ] **Step 2: Test the handlers**

```cs
// mod-tests/EffectAllowListHandlersTests.cs (use synthetic instances; full integration covered in Phase 10's tests)
using ArdenfallCompendium.Effects.Serialization;
using ArdenfallCompendium.Walker;
using Newtonsoft.Json.Linq;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class EffectAllowListHandlersTests
{
    [Fact]
    public void LeveledFloatHandlerEmitsBaseAndScale()
    {
        var dispatcher = EffectTypeDispatcher.Default();
        EffectAllowListHandlers.RegisterAll(dispatcher, new RefResolver(/* test ctor */), "owner-1");
        var value = new Ardenfall.LeveledFloat { BaseValue = 3.5f, LevelScale = 0.5f };
        var token = dispatcher.Convert(value, typeof(Ardenfall.LeveledFloat), out _);
        Assert.IsType<JObject>(token);
        Assert.Equal(3.5f, ((JObject)token)["baseValue"]!.Value<float>());
    }
}
```

If `LeveledFloat`'s constructor differs, instantiate via reflection or use a small in-repo test double.

- [ ] **Step 3: Run + commit**

Run: `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --filter EffectAllowListHandlersTests`

```sh
git add mod/src/Effects/Serialization/EffectAllowListHandlers.cs mod-tests/EffectAllowListHandlersTests.cs
git commit -m "feat(mod): effect allow-list handlers"
```

### Task 7.4: `EffectSerializer` — reflect fields and call dispatcher

**Files:**

- Create: `mod/src/Effects/Serialization/EffectSerializer.cs`
- Test: `mod-tests/EffectSerializerTests.cs`

- [ ] **Step 1: Implement the serializer**

```cs
// mod/src/Effects/Serialization/EffectSerializer.cs
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Walker;
using Newtonsoft.Json.Linq;

namespace ArdenfallCompendium.Effects.Serialization;

public sealed class EffectSerializer
{
    private readonly RefResolver _refs;

    public EffectSerializer(RefResolver refs)
    {
        _refs = refs;
    }

    public EffectInstanceSnapshot Serialize(object effect, string ownerId, string ownerScope, int effectIndex)
    {
        var dispatcher = EffectTypeDispatcher.Default();
        EffectAllowListHandlers.RegisterAll(dispatcher, _refs, ownerId);
        var diagnostics = new List<Diagnostic>();
        var payload = new JObject();
        var type = effect.GetType();
        foreach (var field in type.GetFields(BindingFlags.Instance | BindingFlags.Public))
        {
            var token = dispatcher.ConvertInternal(field.GetValue(effect), field.FieldType, diagnostics);
            payload[CamelCase(field.Name)] = token;
        }
        foreach (var prop in type.GetProperties(BindingFlags.Instance | BindingFlags.Public))
        {
            if (!prop.CanRead || prop.GetIndexParameters().Length > 0) continue;
            try
            {
                var token = dispatcher.ConvertInternal(prop.GetValue(effect), prop.PropertyType, diagnostics);
                payload[CamelCase(prop.Name)] = token;
            }
            catch (TargetInvocationException ex)
            {
                diagnostics.Add(new Diagnostic
                {
                    Severity = "diagnostic",
                    Code = "effectPropertyThrew",
                    Field = $"{type.Name}.{prop.Name}",
                    Message = ex.InnerException?.Message ?? ex.Message,
                });
            }
        }
        return new EffectInstanceSnapshot(type.Name, payload, diagnostics);
    }

    private static string CamelCase(string name) =>
        string.IsNullOrEmpty(name) ? name : char.ToLowerInvariant(name[0]) + name.Substring(1);
}
```

- [ ] **Step 2: Test with a real `Effect` subclass**

```cs
// mod-tests/EffectSerializerTests.cs
using ArdenfallCompendium.Effects.Serialization;
using ArdenfallCompendium.Walker;
using Newtonsoft.Json.Linq;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class EffectSerializerTests
{
    [Fact]
    public void SerializesModStatEffect()
    {
        var effect = new Ardenfall.ModStatEffect
        {
            stat = /* a synthetic StatType */,
            modification = new Ardenfall.LeveledFloat { BaseValue = 2f, LevelScale = 0.5f },
            addition = true,
        };
        var serializer = new EffectSerializer(new RefResolver(/* ctor */));
        var snap = serializer.Serialize(effect, "owner-1", "status-effect-effects", 0);
        Assert.Equal("ModStatEffect", snap.Kind);
        Assert.Equal(true, snap.Payload["addition"]!.Value<bool>());
        Assert.Equal(2f, snap.Payload["modification"]!["baseValue"]!.Value<float>());
    }
}
```

- [ ] **Step 3: Run + commit**

Run: `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --filter EffectSerializerTests`

```sh
git add mod/src/Effects/Serialization/EffectSerializer.cs mod-tests/EffectSerializerTests.cs
git commit -m "feat(mod): effect instance serializer"
```

### Task 7.5: `EffectInstanceSnapshot` record + diagnostic class import

The shared DTO + diagnostic shape:

```cs
// mod/src/Effects/Serialization/EffectInstanceSnapshot.cs
using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Effects.Serialization;

public sealed record EffectInstanceSnapshot(
    [property: JsonProperty("kind")] string Kind,
    [property: JsonProperty("payload")] JObject Payload,
    [property: JsonIgnore] List<Diagnostic> Diagnostics);
```

Commit if not already part of an earlier task: `feat(mod): effect instance snapshot record`.

### Task 7.6: Phase 7 verification gate

- [ ] Run `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj` — every existing test plus the new ones in Tasks 7.1–7.4 must pass.
- [ ] Run the standard phase gate (no pipeline / site work in this phase; pipeline + site test suites unchanged).
- [ ] `git status --short` clean.
- [ ] Update coordinator phase index row 7 status to ✅.

---

[← Previous phase](06-item-tag.md) · [Next phase →](08-variable-binding-audit.md) · [Coordinator](../2026-05-20-items-presentation-closure.md)
