using System.Collections.Generic;
using ArdenfallCompendium.Dtos;

namespace ArdenfallCompendium.Entities.Location;

public sealed record LocationAssetRecord(
    string? Guid,
    string AssetName,
    bool Enabled,
    string? LocationName,
    SnapshotRef? MapRef,
    string? MapId,
    bool ShowOnMap,
    bool ShowOnMapDebugOnly,
    SnapshotRef? IconRef,
    LocationVector3Snapshot MapPosition,
    bool AllowFastTravel,
    LocationVector3Snapshot? FastTravelPosition,
    IReadOnlyList<LocationVolumeSnapshot?>? Volumes);

public interface ILocationAssetSource
{
    IEnumerable<LocationAssetRecord> EnumerateLocations();
}
