using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.Location;

public sealed record LocationVector3Snapshot(
    [property: JsonProperty("x")] float X,
    [property: JsonProperty("y")] float Y,
    [property: JsonProperty("z")] float Z);

public sealed record LocationVolumeSnapshot(
    [property: JsonProperty("index")] int Index,
    [property: JsonProperty("center")] LocationVector3Snapshot Center,
    [property: JsonProperty("size")] LocationVector3Snapshot Size);

public sealed record LocationSnapshot(
    [property: JsonProperty("id")] string Id,
    [property: JsonProperty("gameLocationId")] string GameLocationId,
    [property: JsonProperty("name")] string Name,
    [property: JsonProperty("enabled")] bool Enabled,
    [property: JsonProperty("mapRef")] SnapshotRef? MapRef,
    [property: JsonProperty("mapId")] string? MapId,
    [property: JsonProperty("showOnMap")] bool ShowOnMap,
    [property: JsonProperty("showOnMapDebugOnly")] bool ShowOnMapDebugOnly,
    [property: JsonProperty("iconRef")] SnapshotRef? IconRef,
    [property: JsonProperty("mapPosition")] LocationVector3Snapshot MapPosition,
    [property: JsonProperty("allowFastTravel")] bool AllowFastTravel,
    [property: JsonProperty("fastTravelPosition")] LocationVector3Snapshot? FastTravelPosition,
    [property: JsonProperty("displayOnEnterVolume")] bool DisplayOnEnterVolume,
    [property: JsonProperty("volumes")] IReadOnlyList<LocationVolumeSnapshot> Volumes);

public sealed class LocationSnapshotRow
{
    [JsonProperty("id")] public string Id { get; init; } = "";
    [JsonProperty("fields")] public LocationSnapshot Fields { get; init; } = null!;
    [JsonProperty("diagnostics")] public List<Diagnostic> Diagnostics { get; init; } = new();
}

public sealed class LocationSnapshotEnvelope
{
    [JsonProperty("entityId")] public string EntityId { get; init; } = "location";
    [JsonProperty("schemaVersion")] public int SchemaVersion { get; init; } = 1;
    [JsonProperty("rows")] public List<LocationSnapshotRow> Rows { get; init; } = new();
}
