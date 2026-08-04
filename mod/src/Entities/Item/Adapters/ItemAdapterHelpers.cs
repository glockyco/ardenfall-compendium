using System.Collections.Generic;
using Ardenfall;
using Ardenfall.Item;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Walker;
using Newtonsoft.Json;
using UnityEngine;

namespace ArdenfallCompendium.Entities.Item.Adapters;

// Fields is the published cross-subsystem contract validated against the descriptor.
// PresentationOnlyFields stays inside the mod and never reaches the snapshot pipeline.
public sealed record ItemAdapterResult(
    Dictionary<string, object?> Fields,
    Dictionary<string, Provenance> Provenance,
    List<Diagnostic> Diagnostics,
    Dictionary<string, object?> PresentationOnlyFields);

public sealed record StackModeSnapshot(
    [property: JsonProperty("type")] string? Type,
    [property: JsonProperty("addLevel")] float AddLevel,
    [property: JsonProperty("maxLevel")] float MaxLevel);

public sealed record LeveledStatusEffectSnapshot(
    [property: JsonProperty("statusEffectRef")] SnapshotRef? StatusEffectRef,
    [property: JsonProperty("level")] float Level,
    [property: JsonProperty("lifetime")] float Lifetime,
    [property: JsonProperty("stackMode")] StackModeSnapshot? StackMode);

public sealed record NoteSectionSnapshot(
    [property: JsonProperty("textContent")] string? TextContent,
    [property: JsonProperty("imageRef")] SnapshotRef? ImageRef,
    [property: JsonProperty("separator")] bool Separator);

public sealed record ColorSnapshot(
    [property: JsonProperty("r")] float R,
    [property: JsonProperty("g")] float G,
    [property: JsonProperty("b")] float B,
    [property: JsonProperty("a")] float A);

public sealed record Vector3Snapshot(
    [property: JsonProperty("x")] float X,
    [property: JsonProperty("y")] float Y,
    [property: JsonProperty("z")] float Z);

public sealed record ProjectileSettingsSnapshot(
    [property: JsonProperty("mass")] float Mass,
    [property: JsonProperty("speed")] float Speed,
    [property: JsonProperty("radius")] float Radius,
    [property: JsonProperty("offset")] Vector3Snapshot Offset,
    [property: JsonProperty("lifetime")] float Lifetime,
    [property: JsonProperty("destroyOnHit")] bool DestroyOnHit,
    [property: JsonProperty("goThroughStatics")] bool GoThroughStatics,
    [property: JsonProperty("goThroughWater")] bool GoThroughWater,
    [property: JsonProperty("enableCustomCollisionRadius")] bool EnableCustomCollisionRadius,
    [property: JsonProperty("customCollisionRadius")] float CustomCollisionRadius,
    [property: JsonProperty("launchPointLerpTime")] float LaunchPointLerpTime,
    [property: JsonProperty("enableSpawnFallback")] bool EnableSpawnFallback,
    [property: JsonProperty("spawnFallbackOffset")] float SpawnFallbackOffset,
    [property: JsonProperty("enableBounce")] bool EnableBounce,
    [property: JsonProperty("enableDestructable")] bool EnableDestructable,
    [property: JsonProperty("destructableHealth")] float DestructableHealth,
    [property: JsonProperty("enableDeflect")] bool EnableDeflect,
    [property: JsonProperty("deflectSpeed")] float DeflectSpeed,
    [property: JsonProperty("deflectMass")] float DeflectMass,
    [property: JsonProperty("knockbackForce")] float KnockbackForce,
    [property: JsonProperty("enableForce")] bool EnableForce,
    [property: JsonProperty("onlyApplyForceToHitObject")] bool OnlyApplyForceToHitObject,
    [property: JsonProperty("forceAmount")] float ForceAmount,
    [property: JsonProperty("forceRange")] float ForceRange,
    [property: JsonProperty("forceOffset")] float ForceOffset);

public sealed record LeveledSpellDataSnapshot(
    [property: JsonProperty("spellRef")] SnapshotRef? SpellRef,
    [property: JsonProperty("spellName")] string? SpellName,
    [property: JsonProperty("level")] float Level,
    [property: JsonProperty("secondaryLevel")] float SecondaryLevel,
    [property: JsonProperty("subSpells")] List<SubSpellSnapshot> SubSpells);

public sealed record SubSpellSnapshot(
    [property: JsonProperty("name")] string? Name,
    [property: JsonProperty("effectTypeNames")] List<string> EffectTypeNames);

public static class ItemAdapterHelpers
{
    public static ItemAdapterResult EmptyResult() =>
        new(
            new Dictionary<string, object?>(System.StringComparer.Ordinal),
            new Dictionary<string, Provenance>(System.StringComparer.Ordinal),
            new List<Diagnostic>(),
            EmptyPresentationOnlyFields());

    public static Dictionary<string, object?> EmptyPresentationOnlyFields() =>
        new(System.StringComparer.Ordinal);

    public static List<Diagnostic> DrainDiagnostics(RefResolver refs)
    {
        var diagnostics = new List<Diagnostic>(refs.Diagnostics);
        refs.Diagnostics.Clear();
        return diagnostics;
    }

    public static SnapshotRef? ResolveOptionalAsset(RefResolver? refs, Object? asset, string field, string rowId, string source)
    {
        if (ReferenceEquals(asset, null) || refs == null) return null;
        var diagnosticCode = "item" + char.ToUpperInvariant(field[0]) + field[1..] + "Missing";
        return refs.ResolveAsset(asset, field, rowId, MissingPolicy.Diagnostic, source, diagnosticCode);
    }

    public static LeveledStatusEffectSnapshot? SnapshotLeveledStatusEffect(LeveledStatusEffect? effect, RefResolver? refs, string rowId)
    {
        if (effect == null) return null;
        var stackMode = effect.StackMode;
        var stackModeSnapshot = stackMode == null
            ? null
            : new StackModeSnapshot(stackMode.type.ToString(), stackMode.addLevel, stackMode.maxLevel);

        return new LeveledStatusEffectSnapshot(
            ResolveOptionalAsset(refs, effect.StatusEffect, "statusEffectRef", rowId, "LeveledStatusEffect.StatusEffect"),
            effect.Level,
            effect.Lifetime,
            stackModeSnapshot);
    }

    public static List<LeveledStatusEffectSnapshot> SnapshotLeveledStatusEffects(LeveledStatusEffect[]? effects, RefResolver? refs, string rowId)
    {
        var snapshots = new List<LeveledStatusEffectSnapshot>();
        if (effects == null) return snapshots;
        foreach (var effect in effects)
        {
            var snapshot = SnapshotLeveledStatusEffect(effect, refs, rowId);
            if (snapshot != null) snapshots.Add(snapshot);
        }
        return snapshots;
    }

    public static List<NoteSectionSnapshot> SnapshotNoteSections(NoteItem.NoteContents? contents, RefResolver? refs, string rowId)
    {
        var snapshots = new List<NoteSectionSnapshot>();
        if (contents?.sections == null) return snapshots;
        foreach (var section in contents.sections)
        {
            if (section == null) continue;
            snapshots.Add(new NoteSectionSnapshot(
                section.textContent,
                ResolveOptionalAsset(refs, section.imageContent, "noteSectionImageRef", rowId, "NoteSection.imageContent"),
                section.separator));
        }
        return snapshots;
    }


    public static ColorSnapshot SnapshotColor(Color color) => new(color.r, color.g, color.b, color.a);

    public static Vector3Snapshot SnapshotVector3(Vector3 value) => new(value.x, value.y, value.z);

    public static ProjectileSettingsSnapshot? SnapshotProjectileSettings(ProjectileSettings? settings)
    {
        if (settings == null) return null;
        return new ProjectileSettingsSnapshot(
            settings.mass,
            settings.speed,
            settings.radius,
            SnapshotVector3(settings.offset),
            settings.lifetime,
            settings.destroyOnHit,
            settings.goThroughStatics,
            settings.goThroughWater,
            settings.enableCustomCollisionRadius,
            settings.customCollisionRadius,
            settings.launchPointLerpTime,
            settings.enableSpawnFallback,
            settings.spawnFallbackOffset,
            settings.enableBounce,
            settings.enableDestructable,
            settings.destructableHealth,
            settings.enableDeflect,
            settings.deflectSpeed,
            settings.deflectMass,
            settings.knockbackForce,
            settings.enableForce,
            settings.onlyApplyForceToHitObject,
            settings.forceAmount,
            settings.forceRange,
            settings.forceOffset);
    }

    public static LeveledSpellDataSnapshot? SnapshotLeveledSpellData(LeveledSpellData? spell, RefResolver? refs, string rowId)
    {
        if (spell == null) return null;
        var spellData = spell.spellData;
        return new LeveledSpellDataSnapshot(
            ResolveOptionalAsset(refs, spellData, "spellRef", rowId, "LeveledSpellData.spellData"),
            spellData?.spellName,
            spell.level,
            spell.GetSecondaryLevel(),
            SnapshotSubSpells(spellData));
    }

    public static List<SubSpellSnapshot> SnapshotSubSpells(SpellData? spellData)
    {
        var snapshots = new List<SubSpellSnapshot>();
        if (spellData?.subSpells == null) return snapshots;
        foreach (var subSpell in spellData.subSpells)
        {
            if (subSpell == null) continue;
            var effectNames = new List<string>();
            if (subSpell.effects != null)
            {
                foreach (var effect in subSpell.effects)
                {
                    if (effect != null) effectNames.Add(effect.GetType().Name);
                }
            }
            snapshots.Add(new SubSpellSnapshot(subSpell.name, effectNames));
        }
        return snapshots;
    }
}
