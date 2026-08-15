using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.CharacterRace;

public sealed record CharacterRaceSnapshot(
    [property: JsonProperty("id")] string Id,
    [property: JsonProperty("raceName")] string? RaceName,
    [property: JsonProperty("nameSetRefs")] List<SnapshotRef> NameSetRefs);

public sealed class CharacterRaceSnapshotRow
{
    [JsonProperty("id")] public string Id { get; init; } = "";
    [JsonProperty("fields")] public CharacterRaceSnapshot Fields { get; init; } = null!;
    [JsonProperty("diagnostics")] public List<Diagnostic> Diagnostics { get; init; } = new();
}

public sealed class CharacterRaceSnapshotEnvelope
{
    [JsonProperty("entityId")] public string EntityId { get; init; } = "character-race";
    [JsonProperty("schemaVersion")] public int SchemaVersion { get; init; } = 1;
    [JsonProperty("rows")] public List<CharacterRaceSnapshotRow> Rows { get; init; } = new();
}
