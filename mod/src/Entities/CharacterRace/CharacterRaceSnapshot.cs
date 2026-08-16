using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.CharacterRace;

public sealed record CharacterRaceSnapshot(
    [property: JsonProperty("id")] string Id,
    [property: JsonProperty("raceName")] string? RaceName,
    [property: JsonProperty("raceNameProvenance")] string RaceNameProvenance,
    [property: JsonProperty("raceNameOwner")] string? RaceNameOwner,
    [property: JsonProperty("nameSetRefs")] List<SnapshotRef> NameSetRefs,
    [property: JsonProperty("parentRef")] SnapshotRef ParentRef);

public sealed class CharacterRaceSnapshotRow
{
    [JsonProperty("id")] public string Id { get; init; } = "";
    [JsonProperty("fields")] public CharacterRaceSnapshot Fields { get; init; } = null!;
    [JsonProperty("provenance")] public Dictionary<string, Provenance> Provenance { get; init; } = new();
    [JsonProperty("diagnostics")] public List<Diagnostic> Diagnostics { get; init; } = new();
}

public sealed class CharacterRaceSnapshotEnvelope
{
    [JsonProperty("entityId")] public string EntityId { get; init; } = "character-race";
    [JsonProperty("schemaVersion")] public int SchemaVersion { get; init; } = 1;
    [JsonProperty("rows")] public List<CharacterRaceSnapshotRow> Rows { get; init; } = new();
}
