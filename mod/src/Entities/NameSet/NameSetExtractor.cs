using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities;
using ArdenfallCompendium.Walker;

namespace ArdenfallCompendium.Entities.NameSet;

public sealed class NameSetExtractor : WalkerBase<NameSetSnapshotRow>
{
    private readonly INameSetAssetSource _source;

    public NameSetExtractor()
        : this(new LoadedNameSetAssetSource())
    {
    }

    public NameSetExtractor(INameSetAssetSource source)
    {
        _source = source;
    }

    public override IEnumerable<NameSetSnapshotRow> Walk() =>
        ExtractorLifecycle.Run(
            _source.EnumerateNameSets(),
            Diagnostics,
            Refs,
            () => new Diagnostic
            {
                Severity = "fatal",
                Code = "nameSetAssetMissing",
                Field = "id",
                Message = "NameSet asset source yielded a null row",
            },
            asset =>
            {
                var assetName = asset.AssetName ?? "";
                if (!NamedAssetIdentity.TryCreate("name-set", assetName, out var id))
                {
                    return ExtractorIdentity.Invalid(new Diagnostic
                    {
                        Severity = "fatal",
                        Code = "namedAssetNameMissing",
                        Field = "id",
                        Message = $"NameSet asset has empty or whitespace name '{assetName}'",
                    });
                }

                return ExtractorIdentity.Valid(id);
            },
            (asset, id) =>
            {
                var seeds = new List<NameSetSeedSnapshot>();
                if (asset.Seeds == null)
                {
                    Diagnostics.Add(new Diagnostic
                    {
                        Severity = "diagnostic",
                        Code = "nameSetSeedsMissing",
                        Field = "seeds",
                        Message = $"NameSet '{id}' has null seeds data",
                    });
                }
                else
                {
                    for (var index = 0; index < asset.Seeds.Count; index++)
                    {
                        var seed = asset.Seeds[index];
                        if (seed == null || string.IsNullOrWhiteSpace(seed.Name))
                        {
                            Diagnostics.Add(new Diagnostic
                            {
                                Severity = "diagnostic",
                                Code = "nameSetSeedMissing",
                                Field = $"seeds[{index}]",
                                Message = $"NameSet '{id}' has an empty or null seed at index {index}",
                            });
                            continue;
                        }

                        seeds.Add(new NameSetSeedSnapshot(
                            Name: seed.Name,
                            Weight: seed.Weight));
                    }
                }

                return new NameSetSnapshotRow
                {
                    Id = id,
                    Fields = new NameSetSnapshot(
                        Id: id,
                        Seeds: seeds,
                        GenerationOrder: asset.GenerationOrder),
                };
            });
}
