using System;
using System.Collections.Generic;
using System.Linq;
using Ardenfall;
using Ardenfall.Item;
using Ardenfall.RecordSystem;
using Ardenfall.Questing;
using System.Reflection;
using Ardenfall.Dialog;
using Ardenfall.Dialog.Nodes;
using ArdenfallCompendium.Dtos;
using UnityObject = UnityEngine.Object;

namespace ArdenfallCompendium.Entities.Quest;

public sealed class LoadedQuestAssetSource : IQuestAssetSource
{
    private readonly Func<IEnumerable<QuestData>> _loadedQuests;
    private readonly Func<UnityObject?, bool> _isUnityNull;
    private readonly Func<UnityObject, string> _assetName;
    private readonly Func<UnityObject, bool> _isAuthoredAsset;
    private readonly Func<UnityObject, string?> _lookupGuid;

    public LoadedQuestAssetSource()
        : this(
            loadedQuests: () => UnityEngine.Resources.FindObjectsOfTypeAll<QuestData>(),
            isUnityNull: IsUnityNull,
            assetName: SafeName,
            isAuthoredAsset: IsAuthoredAsset,
            lookupGuid: LookupGuid)
    {
    }

    public LoadedQuestAssetSource(
        Func<IEnumerable<QuestData>> loadedQuests,
        Func<UnityObject?, bool> isUnityNull,
        Func<UnityObject, string>? assetName = null,
        Func<UnityObject, bool>? isAuthoredAsset = null,
        Func<UnityObject, string?>? lookupGuid = null)
    {
        _loadedQuests = loadedQuests;
        _isUnityNull = isUnityNull;
        _assetName = assetName ?? SafeName;
        _isAuthoredAsset = isAuthoredAsset ?? IsAuthoredAsset;
        _lookupGuid = lookupGuid ?? LookupGuid;
    }

    public IEnumerable<QuestAsset> EnumerateQuests()
    {
        var seen = new HashSet<QuestData>(UnityObjectReferenceComparer<QuestData>.Instance);
        var assets = new List<QuestData>();
        foreach (var asset in _loadedQuests())
        {
            if (_isUnityNull(asset))
            {
                yield return null!;
                continue;
            }
            if (!_isAuthoredAsset(asset) || !seen.Add(asset)) continue;
            assets.Add(asset);
        }

        foreach (var asset in assets
                     .Select(ToAsset)
                     .OrderBy(asset => asset.AssetName, StringComparer.Ordinal))
        {
            yield return asset;
        }
    }

    private QuestAsset ToAsset(QuestData quest)
    {
        var objects = quest.objects ?? new List<QuestObject>();
        var characters = new List<QuestCharacterAsset>();
        var journalEntries = new List<QuestJournalAsset>();
        foreach (var questObject in objects)
        {
            if (questObject == null) continue;
            var objectName = NullIfEmpty(questObject.objectName);
            if (questObject is CharacterQuestObject character)
            {
                var characterRef = RecordReferenceSnapshot(character.characterRecord?.record, out var characterRefResolved);
                var dialogue = WalkDialogue(character, out var dialogueGraphWalked);
                characters.Add(new QuestCharacterAsset(
                    ObjectGameId: character.objectID,
                    ObjectName: objectName,
                    Category: NullIfEmpty(character.category),
                    CharacterRef: characterRef,
                    CharacterRefResolved: characterRefResolved,
                    Dialogue: dialogue,
                    DialogueGraphWalked: dialogueGraphWalked));
            }
            else if (questObject is JournalQuestObject journal)
            {
                journalEntries.Add(new QuestJournalAsset(
                    ObjectGameId: journal.objectID,
                    ObjectName: objectName,
                    JournalEntry: NullIfEmpty(journal.journalEntry)));
            }
        }

        return new QuestAsset(
            AssetName: _assetName(quest),
            QuestGameId: NullIfEmpty(quest.questID),
            QuestName: NullIfEmpty(quest.questName),
            QuestSubname: NullIfEmpty(quest.questSubname),
            Disabled: quest.disabled,
            HiddenInQuestUi: quest.hideInQuestUI,
            JournalOnStart: NullIfEmpty(quest.simpleOnStartJournalEntry),
            JournalOnSucceed: NullIfEmpty(quest.simpleOnSucceedJournalEntry),
            JournalOnFailure: NullIfEmpty(quest.simpleOnFailureJournalEntry),
            RequiredCharacterRefs: RequiredCharacterRefs(quest, objects),
            Phases: ReadPhases(quest.phases),
            Characters: characters,
            JournalEntries: journalEntries,
            RewardSets: ReadRewardSets(quest.rewardSets));
    }

    private IReadOnlyList<SnapshotRef> RequiredCharacterRefs(
        QuestData quest,
        IReadOnlyList<QuestObject> objects)
    {
        var refs = new List<SnapshotRef>();
        foreach (var required in quest.requiredCharacters ?? new List<QuestData.RequiredCharacter>())
        {
            var reference = required?.characterReference;
            SnapshotRef? snapshot = null;
            if (reference == null) continue;
            switch (reference.referenceType)
            {
                case QuestCharacterReference.QuestCharacterReferenceType.RecordReference:
                    snapshot = RecordReferenceSnapshot(reference.recordReference);
                    break;
                case QuestCharacterReference.QuestCharacterReferenceType.QuestObjectReference:
                    var character = objects.FirstOrDefault(obj =>
                        obj is CharacterQuestObject && obj.objectID == reference.questObjectId) as CharacterQuestObject;
                    snapshot = RecordReferenceSnapshot(character?.characterRecord?.record);
                    break;
                case QuestCharacterReference.QuestCharacterReferenceType.Player:
                    snapshot = SnapshotRef.Missing("playerReference", "QuestData.requiredCharacters");
                    break;
            }
            if (snapshot != null) refs.Add(snapshot);
        }
        return refs;
    }

    private static IReadOnlyList<QuestPhaseAsset> ReadPhases(IReadOnlyList<QuestPhase>? phases)
    {
        var result = new List<QuestPhaseAsset>();
        foreach (var phase in phases ?? Array.Empty<QuestPhase>())
        {
            if (phase == null) continue;
            var objectives = new List<QuestObjectiveAsset>();
            foreach (var objective in phase.questObjectives ?? new List<QuestObjective>())
            {
                if (objective == null) continue;
                objectives.Add(new QuestObjectiveAsset(
                    ObjectiveGameId: objective.objectiveID,
                    Name: NullIfEmpty(objective.objectiveName),
                    Info: NullIfEmpty(objective.objectiveInfo),
                    JournalEntry: NullIfEmpty(objective.journalEntry),
                    SuccessJournalEntry: NullIfEmpty(objective.successJournalEntry),
                    FailureJournalEntry: NullIfEmpty(objective.failureJournalEntry),
                    ObjectiveType: objective.type.ToString(),
                    Hidden: objective.hidden,
                    AttachedObjectGameId: objective.attachedObjectID,
                    EnableMapMarker: objective.enableMapMarker));
            }
            result.Add(new QuestPhaseAsset(
                PhaseGameId: phase.phaseID,
                Name: NullIfEmpty(phase.phaseName),
                JournalEntry: NullIfEmpty(phase.journalEntry),
                CompletedJournalEntry: NullIfEmpty(phase.completedJournalEntry),
                Objectives: objectives));
        }
        return result;
    }

    private IReadOnlyList<QuestRewardSetAsset> ReadRewardSets(IReadOnlyList<QuestRewardSet>? sets)
    {
        var result = new List<QuestRewardSetAsset>();
        foreach (var set in sets ?? Array.Empty<QuestRewardSet>())
        {
            if (set == null) continue;
            var rewards = new List<QuestRewardAsset>();
            foreach (var reward in set.questRewards ?? new List<QuestReward>())
            {
                if (reward == null) continue;
                rewards.Add(ReadReward(reward));
            }
            result.Add(new QuestRewardSetAsset(
                SetGameId: set.rewardSetID,
                SetName: NullIfEmpty(set.rewardSetName),
                SetType: set.rewardSetType.ToString(),
                Rewards: rewards));
        }
        return result;
    }

    private QuestRewardAsset ReadReward(QuestReward reward) => reward switch
    {
        XPQuestReward xp => new QuestRewardAsset(
            Kind: "experience",
            AmountLabel: xp.xpAmount.ToString(),
            CustomAmount: string.Equals(xp.xpAmount.ToString(), "Custom", StringComparison.Ordinal)
                ? xp.customXPAmount
                : null),
        GoldQuestReward gold => new QuestRewardAsset(
            Kind: "gold",
            CustomAmount: gold.customGoldAmount),
        FactionRepQuestReward faction => new QuestRewardAsset(
            Kind: "faction-reputation",
            IsPositive: faction.isPositive,
            AmountLabel: faction.amount.ToString(),
            CustomAmount: string.Equals(faction.amount.ToString(), "Custom", StringComparison.Ordinal)
                ? faction.customReputation
                : null,
            FactionRef: AssetReference(faction.faction, "FactionRepQuestReward.faction")),
        CharacterRepQuestReward character => new QuestRewardAsset(
            Kind: "character-reputation",
            IsPositive: character.isPositive,
            AmountLabel: character.amount.ToString(),
            CustomAmount: string.Equals(character.amount.ToString(), "Custom", StringComparison.Ordinal)
                ? character.customReputation
                : null,
            TargetObjectGameId: character.questObjectId),
        ItemsQuestReward items => new QuestRewardAsset(
            Kind: "items",
            Items: ItemReferences(items.items, "ItemsQuestReward.items"),
            ItemListRefs: ItemListReferences(items.itemLists, "ItemsQuestReward.itemLists")),
        _ => throw new InvalidOperationException(
            $"Quest reward type '{reward.GetType().FullName}' is not supported."),
    };

    private IReadOnlyList<QuestRewardItemAsset> ItemReferences(
        IEnumerable<CountedItemData>? items,
        string source)
    {
        var refs = new List<QuestRewardItemAsset>();
        foreach (var counted in items ?? Array.Empty<CountedItemData>())
        {
            if (counted?.item != null)
            {
                var snapshot = AssetReference(counted.item, source);
                if (snapshot != null) refs.Add(new QuestRewardItemAsset(snapshot, counted.count));
            }
        }
        return refs;
    }

    private IReadOnlyList<SnapshotRef> ItemListReferences(
        IEnumerable<CountedItemListAsset>? lists,
        string source)
    {
        var refs = new List<SnapshotRef>();
        foreach (var counted in lists ?? Array.Empty<CountedItemListAsset>())
        {
            if (counted?.list != null)
            {
                var snapshot = AssetReference(counted.list, source);
                if (snapshot != null) refs.Add(snapshot);
            }
        }
        return refs;
    }

    private SnapshotRef? AssetReference(UnityObject? asset, string source)
    {
        if (asset == null) return null;
        var guid = _lookupGuid(asset);
        return string.IsNullOrWhiteSpace(guid)
            ? SnapshotRef.Missing("lookupAssetGuidMissing", source)
            : SnapshotRef.LookupAsset(guid, asset.GetType().FullName, _assetName(asset));
    }

    /// <summary>
    /// Reads the authored dialogue a quest attaches to one of its character objects.
    /// </summary>
    /// <remarks>
    /// A quest owns dialogue, not a character. <c>CharacterData.characterGraphs</c> holds
    /// character behaviour graphs: a live probe measured 195 of its 196 containers as plain
    /// <c>ObjectFlowGraph</c>, with a single <c>DialogFlowGraph</c> among them. The authored
    /// dialogue lives on <c>CharacterQuestObject.dialogGraph.flowGraph</c>, on 82 of 88 such
    /// objects.
    ///
    /// Greetings expose pure public accessors. Topics do not: <c>ITopicNode.GetTopicStatements</c>
    /// consults live graph state through <c>IsNodeChoiceEntered</c> and <c>ApplyModifiers</c>,
    /// which no asset-time walk can satisfy, so the authored <c>statement</c> field is read
    /// directly. That field is also the text a reader wants: unsubstituted source prose, before
    /// the runtime rewrites it with a debug prefix or a failed-check alternative.
    /// </remarks>
    /// <param name="walked">
    /// True when a dialogue graph was present and its nodes were enumerated, whatever the walk
    /// yielded. Distinguishes "this object has no dialogue" from "a graph produced no lines".
    /// </param>
    private static IReadOnlyList<QuestCharacterDialogueAsset> WalkDialogue(
        CharacterQuestObject character,
        out bool walked)
    {
        walked = false;
        var lines = new List<QuestCharacterDialogueAsset>();
        if (character.dialogGraph?.flowGraph?.graph is not DialogFlowGraph graph) return lines;

        var nodes = graph.allNodes;
        if (nodes == null) return lines;

        walked = true;
        var ordinal = 0;
        foreach (var node in nodes)
        {
            var current = ordinal++;
            switch (node)
            {
                case GreetingFlowNode greeting:
                    AddLine(lines, current, "greeting", greeting.EditorGetStatement()?.text, greeting.GetImportance());
                    break;
                case TopicFlowNode topic:
                    AddLine(lines, current, "topic", AuthoredStatementText(topic), ((ITopicNode)topic).Importance);
                    break;
            }
        }

        return lines;
    }

    private static void AddLine(
        List<QuestCharacterDialogueAsset> lines,
        int lineOrdinal,
        string kind,
        string? text,
        int importance)
    {
        var authored = NullIfEmpty(text);
        if (authored == null) return;
        lines.Add(new QuestCharacterDialogueAsset(lineOrdinal, kind, authored, importance));
    }

    private static readonly FieldInfo? TopicStatementField = typeof(TopicFlowNode)
        .GetField("statement", BindingFlags.Instance | BindingFlags.NonPublic);

    private static string? AuthoredStatementText(TopicFlowNode topic) =>
        TopicStatementField?.GetValue(topic) is Statement statement ? statement.text : null;

    private static SnapshotRef? RecordReferenceSnapshot(RecordReference? reference)
    {
        return RecordReferenceSnapshot(reference, out _);
    }

    private static SnapshotRef? RecordReferenceSnapshot(RecordReference? reference, out bool resolved)
    {
        resolved = false;
        if (reference == null || reference.RecordID.IsNull()) return null;
        var id = reference.RecordID;
        resolved = !reference.IsNull;
        return SnapshotRef.Record(id.table, id.subtable, id.id, "CharacterRecord");
    }

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;

    private static bool IsUnityNull(UnityObject? asset)
    {
        if (ReferenceEquals(asset, null)) return true;
        try { return asset == null; }
        catch (Exception exception) { throw new InvalidOperationException("QuestData lookup failed for field 'asset'.", exception); }
    }

    private static string SafeName(UnityObject asset)
    {
        try { return asset.name ?? ""; }
        catch (Exception exception) { throw new InvalidOperationException("QuestData lookup failed for field 'name'.", exception); }
    }

    private static bool IsAuthoredAsset(UnityObject asset)
    {
        try { return (asset.hideFlags & UnityEngine.HideFlags.DontSave) == 0; }
        catch (Exception exception) { throw new InvalidOperationException("QuestData lookup failed for field 'hideFlags'.", exception); }
    }

    private static string? LookupGuid(UnityObject asset)
    {
        var lookup = BuiltLookupTable.Instance;
        if (lookup == null) return null;
        var guid = lookup.GetGuid(asset);
        return string.IsNullOrWhiteSpace(guid) ? null : guid;
    }
}
