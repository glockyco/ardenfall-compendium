using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.Quest;

public sealed record QuestObjectiveSnapshot(
    [property: JsonProperty("objectiveGameId")] int ObjectiveGameId,
    [property: JsonProperty("name")] string? Name,
    [property: JsonProperty("info")] string? Info,
    [property: JsonProperty("journalEntry")] string? JournalEntry,
    [property: JsonProperty("successJournalEntry")] string? SuccessJournalEntry,
    [property: JsonProperty("failureJournalEntry")] string? FailureJournalEntry,
    [property: JsonProperty("objectiveType")] string ObjectiveType,
    [property: JsonProperty("hidden")] bool Hidden,
    [property: JsonProperty("attachedObjectGameId")] int? AttachedObjectGameId,
    [property: JsonProperty("enableMapMarker")] bool EnableMapMarker);

public sealed record QuestPhaseSnapshot(
    [property: JsonProperty("phaseGameId")] int PhaseGameId,
    [property: JsonProperty("name")] string? Name,
    [property: JsonProperty("journalEntry")] string? JournalEntry,
    [property: JsonProperty("completedJournalEntry")] string? CompletedJournalEntry,
    [property: JsonProperty("objectives")] IReadOnlyList<QuestObjectiveSnapshot> Objectives);

public sealed record QuestCharacterDialogueSnapshot(
    [property: JsonProperty("lineOrdinal")] int LineOrdinal,
    [property: JsonProperty("kind")] string Kind,
    [property: JsonProperty("text")] string Text,
    [property: JsonProperty("importance")] int Importance);

public sealed record QuestCharacterSnapshot(
    [property: JsonProperty("objectGameId")] int ObjectGameId,
    [property: JsonProperty("objectName")] string? ObjectName,
    [property: JsonProperty("category")] string? Category,
    [property: JsonProperty("characterRef")] SnapshotRef CharacterRef,
    [property: JsonProperty("dialogue")] IReadOnlyList<QuestCharacterDialogueSnapshot> Dialogue);

public sealed record QuestJournalSnapshot(
    [property: JsonProperty("objectGameId")] int ObjectGameId,
    [property: JsonProperty("objectName")] string? ObjectName,
    [property: JsonProperty("journalEntry")] string? JournalEntry);

public sealed record QuestRewardItemSnapshot(
    [property: JsonProperty("ref")] SnapshotRef Ref,
    [property: JsonProperty("count")] int Count);

public sealed record QuestRewardSnapshot(
    [property: JsonProperty("kind")] string Kind,
    [property: JsonProperty("isPositive")] bool? IsPositive,
    [property: JsonProperty("amountLabel")] string? AmountLabel,
    [property: JsonProperty("customAmount")] int? CustomAmount,
    [property: JsonProperty("factionRef")] SnapshotRef? FactionRef,
    [property: JsonProperty("items")] IReadOnlyList<QuestRewardItemSnapshot> Items,
    [property: JsonProperty("itemListRefs")] IReadOnlyList<SnapshotRef> ItemListRefs,
    [property: JsonProperty("targetObjectGameId")] int? TargetObjectGameId);

public sealed record QuestRewardSetSnapshot(
    [property: JsonProperty("setGameId")] int SetGameId,
    [property: JsonProperty("setName")] string? SetName,
    [property: JsonProperty("setType")] string SetType,
    [property: JsonProperty("rewards")] IReadOnlyList<QuestRewardSnapshot> Rewards);

public sealed record QuestSnapshotFields(
    [property: JsonProperty("id")] string Id,
    [property: JsonProperty("questGameId")] string QuestGameId,
    [property: JsonProperty("name")] string? Name,
    [property: JsonProperty("subname")] string? Subname,
    [property: JsonProperty("disabled")] bool Disabled,
    [property: JsonProperty("hiddenInQuestUi")] bool HiddenInQuestUi,
    [property: JsonProperty("journalOnStart")] string? JournalOnStart,
    [property: JsonProperty("journalOnSucceed")] string? JournalOnSucceed,
    [property: JsonProperty("journalOnFailure")] string? JournalOnFailure,
    [property: JsonProperty("requiredCharacterRefs")] IReadOnlyList<SnapshotRef> RequiredCharacterRefs,
    [property: JsonProperty("phases")] IReadOnlyList<QuestPhaseSnapshot> Phases,
    [property: JsonProperty("characters")] IReadOnlyList<QuestCharacterSnapshot> Characters,
    [property: JsonProperty("journalEntries")] IReadOnlyList<QuestJournalSnapshot> JournalEntries,
    [property: JsonProperty("rewardSets")] IReadOnlyList<QuestRewardSetSnapshot> RewardSets);

public sealed class QuestSnapshotRow
{
    [JsonProperty("id")] public string Id { get; init; } = "";
    [JsonProperty("fields")] public QuestSnapshotFields Fields { get; init; } = null!;
    [JsonProperty("diagnostics")] public List<Diagnostic> Diagnostics { get; init; } = new();
}

public sealed class QuestSnapshotEnvelope
{
    [JsonProperty("entityId")] public string EntityId { get; init; } = "quest";
    [JsonProperty("schemaVersion")] public int SchemaVersion { get; init; } = 1;
    [JsonProperty("rows")] public List<QuestSnapshotRow> Rows { get; init; } = new();
}
