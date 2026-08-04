using System.Linq;
using System;
using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities;
using ArdenfallCompendium.Walker;

namespace ArdenfallCompendium.Entities.Quest;

public sealed class QuestExtractor : WalkerBase<QuestSnapshotRow>
{
    private readonly IQuestAssetSource _source;

    public QuestExtractor()
        : this(new LoadedQuestAssetSource())
    {
    }

    public QuestExtractor(IQuestAssetSource source)
    {
        _source = source;
    }

    public override IEnumerable<QuestSnapshotRow> Walk()
    {
        return ExtractorLifecycle.Run(
            _source.EnumerateQuests(),
            Diagnostics,
            Refs,
            () => new Diagnostic
            {
                Severity = "fatal",
                Code = "questAssetMissing",
                Field = "id",
                Message = "QuestData asset source yielded a null row",
            },
            asset => CreateIdentity(asset),
            (asset, id) =>
            {
                var questGameId = NullIfEmpty(asset.QuestGameId);
                if (questGameId == null)
                {
                    Diagnostics.Add(new Diagnostic
                    {
                        Severity = "fatal",
                        Code = "questGameIdMissing",
                        Field = "questID",
                        Message = $"QuestData '{id}' has empty or whitespace questID",
                    });
                    return null;
                }

                var name = NullIfEmpty(asset.QuestName);
                if (name == null)
                {
                    Diagnostics.Add(new Diagnostic
                    {
                        Severity = "diagnostic",
                        Code = "questNameMissing",
                        Field = "questName",
                        Message = $"QuestData '{id}' has empty or whitespace questName",
                    });
                }

                var characters = new List<QuestCharacterSnapshot>();
                foreach (var character in asset.Characters)
                {
                    var characterRef = character.CharacterRef;
                    if (characterRef == null)
                    {
                        Diagnostics.Add(new Diagnostic
                        {
                            Severity = "diagnostic",
                            Code = "questCharacterReferenceMissing",
                            Field = "characters.characterRef",
                            Message = $"QuestData '{id}' character object {character.ObjectGameId} has no character record reference",
                        });
                        characterRef = SnapshotRef.Missing(
                            "characterRecordMissing",
                            "QuestData.objects.CharacterQuestObject.characterRecord.record");
                    }
                    else if (!character.CharacterRefResolved)
                    {
                        Diagnostics.Add(new Diagnostic
                        {
                            Severity = "diagnostic",
                            Code = "questCharacterReferenceUnresolved",
                            Field = "characters.characterRef",
                            Message = $"QuestData '{id}' character object {character.ObjectGameId} has an unresolved character record reference",
                        });
                    }
                    var dialogue = character.Dialogue ?? new List<QuestCharacterDialogueAsset>();
                    if (character.DialogueGraphWalked && dialogue.Count == 0)
                    {
                        Diagnostics.Add(new Diagnostic
                        {
                            Severity = "diagnostic",
                            Code = "questCharacterDialogueGraphEmpty",
                            Field = "characters.dialogue",
                            Message = $"QuestData '{id}' character object {character.ObjectGameId} owns a dialogue graph that yielded no authored greeting or topic",
                        });
                    }
                    characters.Add(new QuestCharacterSnapshot(
                        character.ObjectGameId,
                        character.ObjectName,
                        character.Category,
                        characterRef,
                        dialogue
                            .Select(line => new QuestCharacterDialogueSnapshot(
                                line.LineOrdinal,
                                line.Kind,
                                line.Text,
                                line.Importance))
                            .ToList()));
                }

                return new QuestSnapshotRow
                {
                    Id = id,
                    Fields = new QuestSnapshotFields(
                        Id: id,
                        QuestGameId: questGameId,
                        Name: name,
                        Subname: NullIfEmpty(asset.QuestSubname),
                        Disabled: asset.Disabled,
                        HiddenInQuestUi: asset.HiddenInQuestUi,
                        JournalOnStart: NullIfEmpty(asset.JournalOnStart),
                        JournalOnSucceed: NullIfEmpty(asset.JournalOnSucceed),
                        JournalOnFailure: NullIfEmpty(asset.JournalOnFailure),
                        RequiredCharacterRefs: asset.RequiredCharacterRefs,
                        Phases: BuildPhases(asset.Phases),
                        Characters: characters,
                        JournalEntries: BuildJournalEntries(asset.JournalEntries),
                        RewardSets: BuildRewardSets(asset.RewardSets, id)),
                };
            });
    }

    private static List<QuestPhaseSnapshot> BuildPhases(IReadOnlyList<QuestPhaseAsset> phases)
    {
        var result = new List<QuestPhaseSnapshot>();
        foreach (var phase in phases)
        {
            var objectives = new List<QuestObjectiveSnapshot>();
            foreach (var objective in phase.Objectives)
            {
                objectives.Add(new QuestObjectiveSnapshot(
                    objective.ObjectiveGameId,
                    objective.Name,
                    objective.Info,
                    objective.JournalEntry,
                    objective.SuccessJournalEntry,
                    objective.FailureJournalEntry,
                    objective.ObjectiveType,
                    objective.Hidden,
                    objective.AttachedObjectGameId,
                    objective.EnableMapMarker));
            }
            result.Add(new QuestPhaseSnapshot(
                phase.PhaseGameId,
                phase.Name,
                phase.JournalEntry,
                phase.CompletedJournalEntry,
                objectives));
        }
        return result;
    }

    private static List<QuestJournalSnapshot> BuildJournalEntries(IReadOnlyList<QuestJournalAsset> entries)
    {
        var result = new List<QuestJournalSnapshot>();
        foreach (var entry in entries)
        {
            result.Add(new QuestJournalSnapshot(
                entry.ObjectGameId,
                entry.ObjectName,
                entry.JournalEntry));
        }
        return result;
    }

    private List<QuestRewardSetSnapshot> BuildRewardSets(
        IReadOnlyList<QuestRewardSetAsset> sets,
        string questId)
    {
        var result = new List<QuestRewardSetSnapshot>();
        foreach (var set in sets)
        {
            var rewards = new List<QuestRewardSnapshot>();
            foreach (var (reward, rewardOrdinal) in set.Rewards.Select((value, index) => (value, index)))
            {
                var items = new List<QuestRewardItemSnapshot>();
                foreach (var item in reward.Items ?? Array.Empty<QuestRewardItemAsset>())
                {
                    if (item.Count is not > 0)
                    {
                        Diagnostics.Add(new Diagnostic
                        {
                            Severity = "diagnostic",
                            Code = "questRewardItemCountInvalid",
                            Field = "rewardSets.rewards.items.count",
                            Message = $"QuestData '{questId}' reward set {set.SetGameId} reward {rewardOrdinal} has invalid item count {item.Count?.ToString() ?? "missing"}",
                        });
                        continue;
                    }
                    items.Add(new QuestRewardItemSnapshot(item.Ref, item.Count.Value));
                }
                rewards.Add(new QuestRewardSnapshot(
                    reward.Kind,
                    reward.IsPositive,
                    reward.AmountLabel,
                    reward.CustomAmount,
                    reward.FactionRef,
                    items,
                    reward.ItemListRefs ?? Array.Empty<SnapshotRef>(),
                    reward.TargetObjectGameId));
            }
            result.Add(new QuestRewardSetSnapshot(
                set.SetGameId,
                set.SetName,
                set.SetType,
                rewards));
        }
        return result;
    }

    private static ExtractorIdentity CreateIdentity(QuestAsset asset)
    {
        if (!NamedAssetIdentity.TryCreate("quest", asset.AssetName ?? "", out var id))
        {
            return ExtractorIdentity.Invalid(new Diagnostic
            {
                Severity = "fatal",
                Code = "namedAssetNameMissing",
                Field = "id",
                Message = $"QuestData asset has empty or whitespace name '{asset.AssetName}'",
            });
        }
        return ExtractorIdentity.Valid(id);
    }

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}
