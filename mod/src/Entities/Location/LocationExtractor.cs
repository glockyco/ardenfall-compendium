using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities;
using ArdenfallCompendium.Walker;

namespace ArdenfallCompendium.Entities.Location;

public sealed class LocationExtractor : WalkerBase<LocationSnapshotRow>
{
    private readonly ILocationAssetSource _source;

    public LocationExtractor()
        : this(new BuiltLookupTableLocationAssetSource())
    {
    }

    public LocationExtractor(ILocationAssetSource source)
    {
        _source = source;
    }

    public override IEnumerable<LocationSnapshotRow> Walk()
    {
        return ExtractorLifecycle.Run(
            _source.EnumerateLocations(),
            Diagnostics,
            Refs,
            () => new Diagnostic
            {
                Severity = "fatal",
                Code = "locationAssetMissing",
                Field = "id",
                Message = "Location asset source yielded a null row",
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
                        Message = $"LocationAsset '{asset.AssetName}' has no GUID in BuiltLookupTable",
                    });
                }
                return ExtractorIdentity.Valid(asset.Guid);
            },
            (asset, id) =>
            {
                var rowDiagnostics = new List<Diagnostic>();
                if (asset.MapId == null)
                {
                    rowDiagnostics.Add(new Diagnostic
                    {
                        Severity = "diagnostic",
                        Code = "locationMapMissing",
                        Field = "mapId",
                        Message = $"LocationAsset '{id}' has no map",
                    });
                }

                var volumes = new List<LocationVolumeSnapshot>();
                if (asset.Volumes == null)
                {
                    rowDiagnostics.Add(new Diagnostic
                    {
                        Severity = "diagnostic",
                        Code = "locationVolumesMalformed",
                        Field = "volumes",
                        Message = $"LocationAsset '{id}' has null volume data",
                    });
                }
                else
                {
                    for (var index = 0; index < asset.Volumes.Count; index++)
                    {
                        var volume = asset.Volumes[index];
                        if (volume == null)
                        {
                            rowDiagnostics.Add(new Diagnostic
                            {
                                Severity = "diagnostic",
                                Code = "locationVolumeMalformed",
                                Field = $"volumes[{index}]",
                                Message = $"LocationAsset '{id}' has null volume data at index {index}",
                            });
                            continue;
                        }
                        volumes.Add(volume);
                    }
                }

                var name = NullIfEmpty(asset.LocationName);
                if (name == null)
                {
                    rowDiagnostics.Add(new Diagnostic
                    {
                        Severity = "diagnostic",
                        Code = "locationNameMissing",
                        Field = "name",
                        Message = $"LocationAsset '{id}' has empty or whitespace locationName",
                    });
                }

                return new LocationSnapshotRow
                {
                    Id = id,
                    Fields = new LocationSnapshot(
                        Id: id,
                        Name: name,
                        Enabled: asset.Enabled,
                        MapRef: asset.MapRef,
                        MapId: asset.MapId,
                        ShowOnMap: asset.ShowOnMap,
                        ShowOnMapDebugOnly: asset.ShowOnMapDebugOnly,
                        IconRef: asset.IconRef,
                        MapPosition: asset.MapPosition,
                        AllowFastTravel: asset.AllowFastTravel,
                        FastTravelPosition: asset.FastTravelPosition,
                        Volumes: volumes),
                    Diagnostics = rowDiagnostics,
                };
            });
    }

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}
