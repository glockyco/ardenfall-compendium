using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Dialogue;

namespace ArdenfallCompendium.Entities.Quest;

public sealed record QuestCharacterAsset(
    int ObjectGameId,
    string? ObjectName,
    string? Category,
    SnapshotRef? CharacterRef,
    bool CharacterRefResolved = true,
    /// <summary>The conversations this object holds, which the dialogue family publishes.</summary>
    IReadOnlyList<string>? DialogueIds = null);

public sealed record QuestJournalAsset(
    int ObjectGameId,
    string? ObjectName,
    string? JournalEntry);

public sealed record QuestObjectiveAsset(
    int ObjectiveGameId,
    string? Name,
    string? Info,
    string? JournalEntry,
    string? SuccessJournalEntry,
    string? FailureJournalEntry,
    string ObjectiveType,
    bool Hidden,
    int? AttachedObjectGameId,
    bool EnableMapMarker);

public sealed record QuestPhaseAsset(
    int PhaseGameId,
    string? Name,
    string? JournalEntry,
    string? CompletedJournalEntry,
    IReadOnlyList<QuestObjectiveAsset> Objectives);

public sealed record QuestRewardItemAsset(
    SnapshotRef Ref,
    int? Count);

public sealed record QuestRewardAsset(
    string Kind,
    bool? IsPositive = null,
    string? AmountLabel = null,
    int? CustomAmount = null,
    SnapshotRef? FactionRef = null,
    IReadOnlyList<QuestRewardItemAsset>? Items = null,
    IReadOnlyList<SnapshotRef>? ItemListRefs = null,
    int? TargetObjectGameId = null);

public sealed record QuestRewardSetAsset(
    int SetGameId,
    string? SetName,
    string SetType,
    IReadOnlyList<QuestRewardAsset> Rewards);

public sealed record QuestAsset(
    string AssetName,
    string? QuestGameId,
    string? QuestName,
    string? QuestSubname,
    bool Disabled,
    bool HiddenInQuestUi,
    string? JournalOnStart,
    string? JournalOnSucceed,
    string? JournalOnFailure,
    IReadOnlyList<SnapshotRef> RequiredCharacterRefs,
    IReadOnlyList<QuestPhaseAsset> Phases,
    IReadOnlyList<QuestCharacterAsset> Characters,
    IReadOnlyList<QuestJournalAsset> JournalEntries,
    IReadOnlyList<QuestRewardSetAsset> RewardSets,
    /// <summary>The walked logic graph, or null when the quest holds none.</summary>
    QuestLogicSnapshot? Logic = null,
    /// <summary>False when the quest holds no logic graph at all.</summary>
    bool LogicGraphWalked = false);

public interface IQuestAssetSource
{
    IEnumerable<QuestAsset> EnumerateQuests();
}
