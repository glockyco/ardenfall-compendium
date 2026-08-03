using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.Character;

public sealed record CharacterSnapshot(
    [property: JsonProperty("id")] string Id,
    [property: JsonProperty("name")] string? Name,
    [property: JsonProperty("dropRefs")] List<SnapshotRef> DropRefs);

public sealed class CharacterSnapshotRow
{
    [JsonProperty("id")] public string Id { get; init; } = "";
    [JsonProperty("fields")] public CharacterSnapshot Fields { get; init; } = null!;
    [JsonProperty("diagnostics")] public List<Diagnostic> Diagnostics { get; init; } = new();
}

public sealed class CharacterSnapshotEnvelope
{
    [JsonProperty("entityId")] public string EntityId { get; init; } = "character";
    [JsonProperty("schemaVersion")] public int SchemaVersion { get; init; } = 1;
    [JsonProperty("rows")] public List<CharacterSnapshotRow> Rows { get; init; } = new();
}
