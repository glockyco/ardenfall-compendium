using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
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
        foreach (var asset in _source.EnumerateLocations())
        {
            if (string.IsNullOrWhiteSpace(asset.Guid))
            {
                Diagnostics.Add(new Diagnostic
                {
                    Severity = "fatal",
                    Code = "lookupAssetGuidMissing",
                    Field = "id",
                    Message = $"LocationAsset '{asset.AssetName}' has no GUID in BuiltLookupTable",
                });
                continue;
            }
            if (string.IsNullOrWhiteSpace(asset.GameLocationId))
            {
                Diagnostics.Add(new Diagnostic
                {
                    Severity = "fatal",
                    Code = "locationIdMissing",
                    Field = "gameLocationId",
                    Message = $"LocationAsset '{asset.Guid}' has no locationID",
                });
                continue;
            }

            var diagnostics = new List<Diagnostic>();
            if (asset.MapId == null)
            {
                diagnostics.Add(new Diagnostic
                {
                    Severity = "diagnostic",
                    Code = "locationMapMissing",
                    Field = "mapId",
                    Message = $"LocationAsset '{asset.Guid}' has no map",
                });
            }

            yield return new LocationSnapshotRow
            {
                Id = asset.Guid,
                Fields = new LocationSnapshot(
                    Id: asset.Guid,
                    GameLocationId: asset.GameLocationId,
                    Name: NullIfEmpty(asset.LocationName) ?? NullIfEmpty(asset.AssetName) ?? asset.Guid,
                    Enabled: asset.Enabled,
                    MapRef: asset.MapRef,
                    MapId: asset.MapId,
                    ShowOnMap: asset.ShowOnMap,
                    ShowOnMapDebugOnly: asset.ShowOnMapDebugOnly,
                    IconRef: asset.IconRef,
                    MapPosition: asset.MapPosition,
                    AllowFastTravel: asset.AllowFastTravel,
                    FastTravelPosition: asset.FastTravelPosition,
                    DisplayOnEnterVolume: asset.DisplayOnEnterVolume,
                    Volumes: asset.Volumes),
                Diagnostics = diagnostics,
            };
        }
    }

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}
