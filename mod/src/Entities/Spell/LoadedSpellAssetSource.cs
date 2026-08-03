using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using ArdenfallCompendium.Dtos;
using UnityObject = UnityEngine.Object;

namespace ArdenfallCompendium.Entities.Spell;

public sealed class LoadedSpellAssetSource : ISpellAssetSource
{
    private readonly Func<IEnumerable<Ardenfall.SpellData>> _loadedSpells;
    private readonly Func<UnityObject?, bool> _isUnityNull;
    private readonly Func<UnityObject, string> _assetName;
    private readonly Func<UnityObject, bool> _isAuthoredAsset;

    public LoadedSpellAssetSource()
        : this(
            loadedSpells: () => UnityEngine.Resources.FindObjectsOfTypeAll<Ardenfall.SpellData>(),
            isUnityNull: IsUnityNull,
            assetName: SafeName,
            isAuthoredAsset: IsAuthoredAsset)
    {
    }

    public LoadedSpellAssetSource(
        Func<IEnumerable<Ardenfall.SpellData>> loadedSpells,
        Func<UnityObject?, bool> isUnityNull,
        Func<UnityObject, string>? assetName = null,
        Func<UnityObject, bool>? isAuthoredAsset = null)
    {
        _loadedSpells = loadedSpells;
        _isUnityNull = isUnityNull;
        _assetName = assetName ?? SafeName;
        _isAuthoredAsset = isAuthoredAsset ?? IsAuthoredAsset;
    }

    public IEnumerable<SpellAsset> EnumerateSpells()
    {
        var seen = new HashSet<Ardenfall.SpellData>(
            UnityObjectReferenceComparer<Ardenfall.SpellData>.Instance);
        var assets = new List<Ardenfall.SpellData>();
        foreach (var asset in _loadedSpells())
        {
            if (_isUnityNull(asset) || !_isAuthoredAsset(asset) || !seen.Add(asset)) continue;
            assets.Add(asset);
        }

        foreach (var asset in assets
                     .Select(ToAsset)
                     .OrderBy(asset => asset.AssetName, StringComparer.Ordinal))
        {
            yield return asset;
        }
    }

    private SpellAsset ToAsset(Ardenfall.SpellData asset)
    {
        var statType = asset.statType;
        var icon = asset.icon;
        return new SpellAsset(
            Guid: null,
            AssetName: _assetName(asset),
            SpellName: asset.spellName,
            StatTypeRef: statType == null
                ? null
                : SnapshotRef.NamedAsset("stat-type", statType.name ?? ""),
            ManaCost: asset.manaCost,
            IsIllegal: asset.isIlligal,
            IconRef: icon == null ? null : SnapshotRef.Missing("engineResource", "SpellData.icon"),
            TooltipSource: NullIfEmpty(asset.tooltip?.GetTooltip(1f, 1f, asset)),
            SpellEffects: ReadSpellEffects(asset));
    }

    private static List<SpellEffectAsset> ReadSpellEffects(Ardenfall.SpellData spell)
    {
        var effects = new List<SpellEffectAsset>();
        foreach (var effect in spell.Spells ?? new List<Ardenfall.SpellEffect>())
        {
            if (effect == null) continue;
            // SelfStatusEffectSpellEffect maps to apply-status-to-self.
            // TargetStatusEffectSpellEffect maps to apply-status-to-target.
            // ProjectileSpellEffect maps to projectile and supplies damage.
            // AOESpellEffect maps to area-of-effect and normalises applyDamage to damage.
            // RangedAttackSpellEffect maps to ranged-attack.
            // FlingSpellEffect maps to fling. TrapSpellEffect maps to trap.
            // SpawnPrefabSpellEffect maps to spawn-prefab.
            // ProjectilePrefabSpellEffect maps to projectile-prefab.
            // RaiseDeadSpellEffect maps to raise-dead.
            // RaiseDeadAOESpellEffect maps to raise-dead-area.
            // SummonCharacterSpellEffect maps to summon-character.
            // SummonDecoySpellEffect maps to summon-decoy.
            // IncreaseCompanionTimeSpellEffect maps to increase-companion-time.
            switch (effect)
            {
                case Ardenfall.SelfStatusEffectSpellEffect self:
                    effects.Add(StatusAsset(
                        "apply-status-to-self", ReadField<Ardenfall.LeveledLeveledStatusEffect>(self, "statusEffect"), true));
                    break;
                case Ardenfall.TargetStatusEffectSpellEffect target:
                    foreach (var status in target.statusEffects ?? new List<Ardenfall.LeveledLeveledStatusEffect>())
                    {
                        effects.Add(StatusAsset("apply-status-to-target", status, false));
                    }
                    break;
                case Ardenfall.ProjectileSpellEffect projectile:
                    effects.Add(DamageAsset(
                        "projectile",
                        ReadLevel(projectile, "damage"),
                        ReadField<Ardenfall.DamageType>(projectile, "damageType")));
                    break;
                case Ardenfall.AOESpellEffect aoe:
                    effects.Add(DamageAsset(
                        "area-of-effect",
                        ReadLevel(aoe, "applyDamage"),
                        ReadField<Ardenfall.DamageType>(aoe, "applyDamageType")));
                    break;
                case Ardenfall.RangedAttackSpellEffect _:
                    effects.Add(KindOnly("ranged-attack"));
                    break;
                case Ardenfall.FlingSpellEffect _:
                    effects.Add(KindOnly("fling"));
                    break;
                case Ardenfall.TrapSpellEffect _:
                    effects.Add(KindOnly("trap"));
                    break;
                case Ardenfall.SpawnPrefabSpellEffect _:
                    effects.Add(KindOnly("spawn-prefab"));
                    break;
                case Ardenfall.ProjectilePrefabSpellEffect _:
                    effects.Add(KindOnly("projectile-prefab"));
                    break;
                case Ardenfall.RaiseDeadSpellEffect _:
                    effects.Add(KindOnly("raise-dead"));
                    break;
                case Ardenfall.RaiseDeadAOESpellEffect _:
                    effects.Add(KindOnly("raise-dead-area"));
                    break;
                case Ardenfall.SummonCharacterSpellEffect _:
                    effects.Add(KindOnly("summon-character"));
                    break;
                case Ardenfall.SummonDecoySpellEffect _:
                    effects.Add(KindOnly("summon-decoy"));
                    break;
                case Ardenfall.IncreaseCompanionTimeSpellEffect _:
                    effects.Add(KindOnly("increase-companion-time"));
                    break;
                // Deliberately omitted from reader output: audio, tooltip plumbing, and AI weighting.
                case Ardenfall.SoundsSpellEffect _:
                case Ardenfall.SubTooltipSpellEffect _:
                case Ardenfall.TargetAIValueSpellEffect _:
                    effects.Add(new SpellEffectAsset("", IsSkipped: true));
                    break;
                default:
                    effects.Add(new SpellEffectAsset(
                        "",
                        GameClassName: effect.GetType().FullName ?? effect.GetType().Name));
                    break;
            }
        }
        return effects;
    }

    private static SpellEffectAsset StatusAsset(
        string kind,
        Ardenfall.LeveledLeveledStatusEffect? wrapper,
        bool appliesToSelf)
    {
        // The game accessor evaluates both values at spell level 1. Lifetime is in seconds.
        return new SpellEffectAsset(
            Kind: kind,
            StatusEffect: wrapper?.StatusEffect,
            SampleLevel: wrapper?.Level?.GetValue(1f) ?? 0f,
            SampleLifetimeSeconds: wrapper?.Lifetime?.GetValue(1f) ?? 0f,
            AppliesToSelf: appliesToSelf);
    }

    private static SpellEffectAsset DamageAsset(
        string kind,
        Ardenfall.LeveledFloat? damage,
        Ardenfall.DamageType? damageType) => new(
            Kind: kind,
            Damage: damage?.GetValue(1f) ?? 0f,
            DamageType: damageType?.damageName ?? "");

    private static SpellEffectAsset KindOnly(string kind) => new(kind);

    private static Ardenfall.LeveledFloat? ReadLevel(object effect, string field) =>
        ReadField<Ardenfall.LeveledFloat>(effect, field);

    private static T ReadField<T>(object effect, string field)
    {
        var info = effect.GetType().GetField(
            field,
            BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
        if (info == null)
        {
            throw new MissingFieldException(effect.GetType().FullName, field);
        }
        return (T)info.GetValue(effect)!;
    }

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;

    private static string SafeName(UnityObject asset)
    {
        try
        {
            return asset.name ?? "";
        }
        catch (Exception exception)
        {
            throw new InvalidOperationException("SpellData lookup failed for field 'name'.", exception);
        }
    }

    private static bool IsUnityNull(UnityObject? asset)
    {
        if (ReferenceEquals(asset, null)) return true;
        try
        {
            return asset == null;
        }
        catch (Exception exception)
        {
            throw new InvalidOperationException("SpellData lookup failed for field 'asset'.", exception);
        }
    }

    private static bool IsAuthoredAsset(UnityObject asset)
    {
        try
        {
            return (asset.hideFlags & UnityEngine.HideFlags.DontSave) == 0;
        }
        catch (Exception exception)
        {
            throw new InvalidOperationException("SpellData lookup failed for field 'hideFlags'.", exception);
        }
    }
}
