using ArdenfallCompendium.Assets;
using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities;
using ArdenfallCompendium.Walker;

namespace ArdenfallCompendium.Entities.Spell;

public sealed class SpellExtractor : WalkerBase<SpellSnapshotRow>
{
    private readonly ISpellAssetSource _source;

    public SpellExtractor()
        : this(new LoadedSpellAssetSource())
    {
    }

    public SpellExtractor(ISpellAssetSource source, IconAssetPlan? assetPlan = null)
    {
        _source = source;
        if (source is IIconAssetPlanSink sink) sink.AttachAssetPlan(assetPlan);
    }

    public override IEnumerable<SpellSnapshotRow> Walk()
    {
        return ExtractorLifecycle.Run(
            _source.EnumerateSpells(),
            Diagnostics,
            Refs,
            () => new Diagnostic
            {
                Severity = "fatal",
                Code = "spellAssetMissing",
                Field = "id",
                Message = "SpellData asset source yielded a null row",
            },
            asset => CreateIdentity(asset),
            (asset, id) =>
            {
                var spellName = NullIfEmpty(asset.SpellName);
                if (spellName == null)
                {
                    Diagnostics.Add(new Diagnostic
                    {
                        Severity = "diagnostic",
                        Code = "spellNameMissing",
                        Field = "spellName",
                        Message = $"SpellData '{id}' has empty or whitespace spellName",
                    });
                }

                var statTypeRef = asset.StatTypeRef;
                var iconRef = asset.IconRef;
                var spellEffects = BuildSpellEffects(asset.SpellEffects, id);
                return new SpellSnapshotRow
                {
                    Id = id,
                    Fields = new SpellSnapshot(
                        Id: id,
                        SpellName: spellName,
                        StatTypeRef: statTypeRef,
                        ManaCost: asset.ManaCost,
                        IsIllegal: asset.IsIllegal,
                        IconRef: iconRef,
                        TooltipSource: NullIfEmpty(asset.TooltipSource),
                        SpellEffects: spellEffects),
                };
            });
    }

    private List<SpellEffectSnapshot> BuildSpellEffects(
        IReadOnlyList<SpellEffectAsset>? effects,
        string spellId)
    {
        var snapshots = new List<SpellEffectSnapshot>();
        foreach (var effect in effects ?? System.Array.Empty<SpellEffectAsset>())
        {
            if (effect.IsSkipped) continue;
            if (effect.GameClassName != null)
            {
                Diagnostics.Add(new Diagnostic
                {
                    Severity = "diagnostic",
                    Code = "spellEffectUnknownClass",
                    Field = "spellEffects",
                    Message = $"SpellData '{spellId}' has unrecognised spell effect class '{effect.GameClassName}'",
                });
                continue;
            }

            if (effect.Kind == "apply-status-to-self" || effect.Kind == "apply-status-to-target")
            {
                var statusRef = Refs.ResolveAsset(
                    effect.StatusEffect,
                    "statusEffectRef",
                    spellId,
                    MissingPolicy.Diagnostic,
                    "spells.spellEffects.statusEffect");
                snapshots.Add(new StatusSpellEffectSnapshot(
                    effect.Kind,
                    statusRef,
                    effect.SampleLevel ?? 0f,
                    effect.SampleLifetimeSeconds ?? 0f,
                    effect.AppliesToSelf));
                continue;
            }

            if (effect.Damage.HasValue)
            {
                snapshots.Add(new DamageSpellEffectSnapshot(
                    effect.Kind,
                    effect.Damage.Value,
                    effect.DamageType ?? ""));
            }
            else
            {
                snapshots.Add(new DirectSpellEffectSnapshot(effect.Kind));
            }
        }
        return snapshots;
    }

    private static ExtractorIdentity CreateIdentity(SpellAsset asset)
    {
        var assetName = asset.AssetName ?? "";
        if (!NamedAssetIdentity.TryCreate("spell", assetName, out var id))
        {
            return ExtractorIdentity.Invalid(new Diagnostic
            {
                Severity = "fatal",
                Code = "namedAssetNameMissing",
                Field = "id",
                Message = $"SpellData asset has empty or whitespace name '{assetName}'",
            });
        }
        return ExtractorIdentity.Valid(id);
    }

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}

