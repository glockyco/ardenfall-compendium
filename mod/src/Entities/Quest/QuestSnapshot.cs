using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Dialogue;
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

public sealed record QuestCharacterSnapshot(
    [property: JsonProperty("objectGameId")] int ObjectGameId,
    [property: JsonProperty("objectName")] string? ObjectName,
    [property: JsonProperty("category")] string? Category,
    [property: JsonProperty("characterRef")] SnapshotRef CharacterRef,
    [property: JsonProperty("dialogueIds")] IReadOnlyList<string> DialogueIds);

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

/// <summary>
/// The authored logic of one quest, read as published data.
/// </summary>
/// <remarks>
/// A quest's logic graph is the same shape as a conversation, and this build's quest graphs hold the
/// node vocabulary the dialogue readers already name: `SetQuestObjectiveStateNode`,
/// `OnEnterQuestLocation`, `AddItemListNode`, `TriggerSteamAchievementNode` and the rest. The walk is
/// shared, so a node kind reads the same on a quest page as it does in a conversation.
/// </remarks>
public sealed record QuestLogicSnapshot(
    [property: JsonProperty("graphName")] string GraphName,
    [property: JsonProperty("nodes")] IReadOnlyList<DialogueNodeSnapshot> Nodes,
    [property: JsonProperty("edges")] IReadOnlyList<DialogueEdgeSnapshot> Edges,
    [property: JsonProperty("entryNodes")] IReadOnlyList<int> EntryNodes,
    /// <summary>Every node type the graph holds, counted, whether the walk models it or not.</summary>
    [property: JsonProperty("census")] IReadOnlyDictionary<string, int> Census);

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
    [property: JsonProperty("rewardSets")] IReadOnlyList<QuestRewardSetSnapshot> RewardSets,
    /// <summary>Null when the quest holds no logic graph, which is a fact rather than a failure.</summary>
    [property: JsonProperty("logic")] QuestLogicSnapshot? Logic);

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
