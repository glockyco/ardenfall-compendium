using ArdenfallCompendium.Assets;
using System;
using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities;
using ArdenfallCompendium.Walker;

namespace ArdenfallCompendium.Entities.Faction;

public sealed class FactionExtractor : WalkerBase<FactionSnapshotRow>
{
    private readonly IFactionAssetSource _source;

    public FactionExtractor()
        : this(new BuiltLookupTableFactionAssetSource())
    {
    }

    public FactionExtractor(IFactionAssetSource source, IconAssetPlan? assetPlan = null)
    {
        _source = source;
        if (source is IIconAssetPlanSink sink) sink.AttachAssetPlan(assetPlan);
    }

    public override IEnumerable<FactionSnapshotRow> Walk()
    {
        return ExtractorLifecycle.Run(
            _source.EnumerateFactions(),
            Diagnostics,
            Refs,
            () => new Diagnostic
            {
                Severity = "fatal",
                Code = "factionAssetMissing",
                Field = "id",
                Message = "Faction asset source yielded a null row",
            },
            asset =>
            {
                if (string.IsNullOrWhiteSpace(asset.Guid))
                {
                    return ExtractorIdentity.Invalid(new Diagnostic
                    {
                        Severity = "fatal",
                        Code = "lookupAssetGuidMissing",
                        Field = "id",
                        Message = $"Faction '{asset.AssetName}' has no GUID in BuiltLookupTable",
                    });
                }
                return ExtractorIdentity.Valid(asset.Guid);
            },
            (asset, id) =>
            {
                var rowDiagnostics = new List<Diagnostic>();
                var name = NullIfEmpty(asset.Title);
                if (name == null)
                {
                    rowDiagnostics.Add(new Diagnostic
                    {
                        Severity = "diagnostic",
                        Code = "factionNameMissing",
                        Field = "name",
                        Message = $"Faction '{id}' has empty or whitespace title",
                    });
                }

                var factionId = NullIfEmpty(asset.FactionId);
                if (factionId == null)
                {
                    rowDiagnostics.Add(new Diagnostic
                    {
                        Severity = "diagnostic",
                        Code = "factionIdMissing",
                        Field = "factionId",
                        Message = $"Faction '{id}' has empty or whitespace id",
                    });
                }

                var relationships = new List<FactionRelationshipSnapshot>();
                if (asset.InterFactionRelationships != null)
                {
                    for (var index = 0; index < asset.InterFactionRelationships.Count; index++)
                    {
                        var relationship = asset.InterFactionRelationships[index];
                        if (relationship == null)
                        {
                            rowDiagnostics.Add(new Diagnostic
                            {
                                Severity = "diagnostic",
                                Code = "factionRelationshipMalformed",
                                Field = $"interFactionRelationships[{index}]",
                                Message = $"Faction '{id}' has a null inter-faction relationship",
                            });
                            continue;
                        }

                        if (!relationship.IsEnemy && relationship.Relationship > 0)
                        {
                            throw new InvalidOperationException(
                                $"Faction '{id}' has a positive starting relationship ({relationship.Relationship}) without isEnemy");
                        }

                        relationships.Add(new FactionRelationshipSnapshot(
                            Faction: relationship.Faction,
                            Relationship: relationship.Relationship,
                            IsEnemy: relationship.IsEnemy));
                    }
                }

                return new FactionSnapshotRow
                {
                    Id = id,
                    Fields = new FactionSnapshot(
                        Id: id,
                        Name: name,
                        FactionId: factionId,
                        Description: NullIfEmpty(asset.Description),
                        IconRef: asset.IconRef,
                        Alliable: asset.Alliable,
                        EnableReputation: asset.EnableReputation,
                        AlwaysShowInUI: asset.AlwaysShowInUI,
                        CanBeDisguised: asset.CanBeDisguised,
                        EnableBounty: asset.EnableBounty,
                        InterFactionRelationships: relationships),
                    Diagnostics = rowDiagnostics,
                };
            });
    }

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}
