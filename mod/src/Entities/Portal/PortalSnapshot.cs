using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.Portal;

public sealed record PortalVector3Snapshot(
    [property: JsonProperty("x")] float X,
    [property: JsonProperty("y")] float Y,
    [property: JsonProperty("z")] float Z);

public sealed record PortalSnapshot(
    [property: JsonProperty("id")] string Id,
    [property: JsonProperty("recordRef")] SnapshotRef RecordRef,
    [property: JsonProperty("friendlyName")] string? FriendlyName,
    [property: JsonProperty("mapId")] string? MapId,
    [property: JsonProperty("position")] PortalVector3Snapshot Position,
    [property: JsonProperty("connectedPortalRef")] SnapshotRef? ConnectedPortalRef);

public sealed class PortalSnapshotRow
{
    [JsonProperty("id")] public string Id { get; init; } = "";
    [JsonProperty("fields")] public PortalSnapshot Fields { get; init; } = null!;
    [JsonProperty("diagnostics")] public List<Diagnostic> Diagnostics { get; init; } = new();
}

public sealed class PortalSnapshotEnvelope
{
    [JsonProperty("entityId")] public string EntityId { get; init; } = "portal";
    [JsonProperty("schemaVersion")] public int SchemaVersion { get; init; } = 1;
    [JsonProperty("rows")] public List<PortalSnapshotRow> Rows { get; init; } = new();
}
