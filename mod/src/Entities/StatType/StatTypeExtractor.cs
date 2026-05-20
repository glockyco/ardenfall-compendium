using System.Collections.Generic;
using System.Linq;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Walker;

namespace ArdenfallCompendium.Entities.StatType;

public sealed class StatTypeExtractor : WalkerBase<StatTypeSnapshotRow>
{
    private readonly IStatTypeAssetSource _source;

    public StatTypeExtractor()
        : this(new BuiltLookupTableStatTypeAssetSource())
    {
    }

    public StatTypeExtractor(IStatTypeAssetSource source)
    {
        _source = source;
    }

    public override IEnumerable<StatTypeSnapshotRow> Walk()
    {
        foreach (var asset in _source.EnumerateStatTypes())
        {
            var guid = asset.Guid;
            if (string.IsNullOrWhiteSpace(guid))
            {
                Diagnostics.Add(new Diagnostic
                {
                    Severity = "fatal",
                    Code = "lookupAssetGuidMissing",
                    Field = "id",
                    Message = $"StatType asset '{asset.AssetName}' has no GUID in BuiltLookupTable",
                });
                continue;
            }

            var iconRef = Refs.ResolveAsset(
                asset.Icon,
                "iconRef",
                guid,
                MissingPolicy.Diagnostic,
                "StatType.icon");

            yield return new StatTypeSnapshotRow
            {
                Id = guid,
                Fields = new StatTypeSnapshot(
                    Id: guid,
                    IsAttribute: asset.IsAttribute,
                    StatName: NullIfEmpty(asset.StatName) ?? NullIfEmpty(asset.AssetName) ?? guid,
                    IconRef: iconRef,
                    IconColor: asset.IconColor,
                    StatDescription: NullIfEmpty(asset.StatDescription),
                    LongStatDescription: NullIfEmpty(asset.LongStatDescription),
                    Affects: asset.Affects?.ToList() ?? new List<string>(),
                    SkillAffects: asset.SkillAffects?.ToList() ?? new List<string>()),
            };
        }

        Diagnostics.AddRange(Refs.Diagnostics);
        Refs.Diagnostics.Clear();
    }

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}
