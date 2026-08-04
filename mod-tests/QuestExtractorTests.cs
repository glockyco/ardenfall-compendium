using System.Collections.Generic;
using System.Linq;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Quest;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class QuestExtractorTests
{
    [Fact]
    public void ExtractsPhasesAndObjectives()
    {
        var source = new FakeQuestAssetSource(new[]
        {
            BuildQuest(phases: new[]
            {
                new QuestPhaseAsset(
                    4,
                    "First phase",
                    "Start journal",
                    "Complete journal",
                    new[]
                    {
                        new QuestObjectiveAsset(
                            7,
                            "Find the key",
                            "Find the key in the ruins",
                            "Objective journal",
                            "Success journal",
                            "Failure journal",
                            "Required",
                            false,
                            12,
                            true),
                    }),
            }),
        });

        var row = Assert.Single(new QuestExtractor(source).Walk());
        var phase = Assert.Single(row.Fields.Phases);
        var objective = Assert.Single(phase.Objectives);

        Assert.Equal("named;quest;quest_phases", row.Id);
        Assert.Equal(4, phase.PhaseGameId);
        Assert.Equal(7, objective.ObjectiveGameId);
        Assert.Equal(12, objective.AttachedObjectGameId);
        Assert.True(objective.EnableMapMarker);
    }

    [Fact]
    public void ExtractsEachRewardKind()
    {
        var rewards = new[]
        {
            new QuestRewardAsset("experience", AmountLabel: "Custom", CustomAmount: 100),
            new QuestRewardAsset("gold", CustomAmount: 25),
            new QuestRewardAsset(
                "faction-reputation",
                IsPositive: false,
                AmountLabel: "Custom",
                CustomAmount: 3,
                FactionRef: SnapshotRef.NamedAsset("faction", "faction_test")),
            new QuestRewardAsset(
                "character-reputation",
                IsPositive: true,
                AmountLabel: "Low",
                CustomAmount: 0,
                TargetObjectGameId: 22),
            new QuestRewardAsset(
                "items",
                Items: new[]
                {
                    new QuestRewardItemAsset(
                        SnapshotRef.LookupAsset("item-guid", "Ardenfall.ItemData", "item_test"),
                        5),
                },
                ItemListRefs: new[] { SnapshotRef.LookupAsset("list-guid", "Ardenfall.ItemListAsset", "list_test") }),
        };
        var source = new FakeQuestAssetSource(new[]
        {
            BuildQuest(rewardSets: new[] { new QuestRewardSetAsset(2, "Rewards", "OnSuccess", rewards) }),
        });

        var extracted = Assert.Single(new QuestExtractor(source).Walk());
        var extractedRewards = Assert.Single(extracted.Fields.RewardSets).Rewards;

        Assert.Equal(new[] { "experience", "gold", "faction-reputation", "character-reputation", "items" },
            extractedRewards.Select(reward => reward.Kind));
        Assert.Equal(100, extractedRewards[0].CustomAmount);
        Assert.Equal("faction", extractedRewards[2].FactionRef?.Entity);
        Assert.Single(extractedRewards[4].Items);
        Assert.Equal(5, extractedRewards[4].Items[0].Count);
        Assert.Single(extractedRewards[4].ItemListRefs);
    }

    [Fact]
    public void ExtractsMultiCountAndSingleCountRewardItems()
    {
        var source = new FakeQuestAssetSource(new[]
        {
            BuildQuest(rewardSets: new[]
            {
                new QuestRewardSetAsset(2, "Rewards", "OnSuccess", new[]
                {
                    new QuestRewardAsset(
                        "items",
                        Items: new[]
                        {
                            new QuestRewardItemAsset(SnapshotRef.NamedAsset("item", "iron_sword"), 5),
                            new QuestRewardItemAsset(SnapshotRef.NamedAsset("item", "stamina_draught"), 1),
                        }),
                }),
            }),
        });

        var reward = Assert.Single(Assert.Single(new QuestExtractor(source).Walk()).Fields.RewardSets).Rewards;
        var items = Assert.Single(reward).Items;

        Assert.Equal(new[] { 5, 1 }, items.Select(item => item.Count));
    }

    [Fact]
    public void InvalidRewardItemCountEmitsDiagnosticAndSkipsItem()
    {
        var source = new FakeQuestAssetSource(new[]
        {
            BuildQuest(rewardSets: new[]
            {
                new QuestRewardSetAsset(2, "Rewards", "OnSuccess", new[]
                {
                    new QuestRewardAsset(
                        "items",
                        Items: new[]
                        {
                            new QuestRewardItemAsset(SnapshotRef.NamedAsset("item", "missing"), null),
                            new QuestRewardItemAsset(SnapshotRef.NamedAsset("item", "zero"), 0),
                            new QuestRewardItemAsset(SnapshotRef.NamedAsset("item", "valid"), 1),
                        }),
                }),
            }),
        });
        var extractor = new QuestExtractor(source);

        var reward = Assert.Single(Assert.Single(extractor.Walk()).Fields.RewardSets).Rewards;

        Assert.Single(Assert.Single(reward).Items);
        Assert.Equal("valid", Assert.Single(Assert.Single(reward).Items).Ref.Name);
        var diagnostics = extractor.Diagnostics.Where(item => item.Code == "questRewardItemCountInvalid").ToList();
        Assert.Equal(2, diagnostics.Count);
        Assert.All(diagnostics, diagnostic =>
        {
            Assert.Equal("diagnostic", diagnostic.Severity);
            Assert.Equal("rewardSets.rewards.items.count", diagnostic.Field);
        });
    }

    [Fact]
    public void EmitsResolvedCharacterObjectReference()
    {
        var source = new FakeQuestAssetSource(new[]
        {
            BuildQuest(characters: new[]
            {
                new QuestCharacterAsset(
                    3,
                    "Quest giver",
                    "Character",
                    SnapshotRef.Record("instances", "characters", "0123456789abcdef0123456789abcdef", "CharacterRecord")),
            }),
        });
        var extractor = new QuestExtractor(source);
        var row = Assert.Single(extractor.Walk());
        var character = Assert.Single(row.Fields.Characters);

        Assert.Equal("record", character.CharacterRef.Kind);
        Assert.Equal("instances", character.CharacterRef.Table);
        Assert.Equal("characters", character.CharacterRef.Subtable);
        Assert.Empty(extractor.Diagnostics);
    }

    [Fact]
    public void MissingCharacterObjectReferenceEmitsDiagnosticAndMissingRef()
    {
        var source = new FakeQuestAssetSource(new[]
        {
            BuildQuest(characters: new[] { new QuestCharacterAsset(3, "Quest giver", "Character", null) }),
        });
        var extractor = new QuestExtractor(source);

        var row = Assert.Single(extractor.Walk());

        var missing = Assert.Single(row.Fields.Characters).CharacterRef;
        Assert.Equal("missing", missing.Kind);
        Assert.Equal("characterRecordMissing", missing.Reason);
        Assert.Equal("QuestData.objects.CharacterQuestObject.characterRecord.record", missing.Source);
        var diagnostic = Assert.Single(extractor.Diagnostics, item => item.Code == "questCharacterReferenceMissing");
        Assert.Equal("diagnostic", diagnostic.Severity);
    }

    [Fact]
    public void UnresolvedCharacterObjectPreservesRecordAndEmitsDiagnostic()
    {
        var source = new FakeQuestAssetSource(new[]
        {
            BuildQuest(characters: new[]
            {
                new QuestCharacterAsset(
                    3,
                    "Quest giver",
                    "Character",
                    SnapshotRef.Record("instances", "characters", "0123456789abcdef0123456789abcdef", "CharacterRecord"),
                    CharacterRefResolved: false),
            }),
        });
        var extractor = new QuestExtractor(source);

        var row = Assert.Single(extractor.Walk());

        var characterRef = Assert.Single(row.Fields.Characters).CharacterRef;
        Assert.Equal("record", characterRef.Kind);
        Assert.Equal("instances", characterRef.Table);
        var diagnostic = Assert.Single(extractor.Diagnostics, item => item.Code == "questCharacterReferenceUnresolved");
        Assert.Equal("diagnostic", diagnostic.Severity);
    }

    [Fact]
    public void EmitsAuthoredDialogueInWalkOrder()
    {
        var source = new FakeQuestAssetSource(new[]
        {
            BuildQuest(characters: new[]
            {
                CharacterWithDialogue(new[]
                {
                    new QuestCharacterDialogueAsset(0, "greeting", "You reek of booze!", 3),
                    new QuestCharacterDialogueAsset(2, "topic", "Who do you guard this port for?", 10),
                }),
            }),
        });
        var extractor = new QuestExtractor(source);

        var row = Assert.Single(extractor.Walk());
        var dialogue = Assert.Single(row.Fields.Characters).Dialogue;

        Assert.Equal(new[] { 0, 2 }, dialogue.Select(line => line.LineOrdinal));
        Assert.Equal(new[] { "greeting", "topic" }, dialogue.Select(line => line.Kind));
        Assert.Equal("You reek of booze!", dialogue[0].Text);
        Assert.Equal(10, dialogue[1].Importance);
        Assert.Empty(extractor.Diagnostics);
    }

    [Fact]
    public void CharacterObjectWithoutDialogueEmitsEmptyListAndNoDiagnostic()
    {
        var source = new FakeQuestAssetSource(new[]
        {
            BuildQuest(characters: new[] { CharacterWithDialogue(null, graphWalked: false) }),
        });
        var extractor = new QuestExtractor(source);

        var row = Assert.Single(extractor.Walk());

        Assert.Empty(Assert.Single(row.Fields.Characters).Dialogue);
        Assert.Empty(extractor.Diagnostics);
    }

    [Fact]
    public void WalkedDialogueGraphYieldingNoLinesEmitsDiagnostic()
    {
        var source = new FakeQuestAssetSource(new[]
        {
            BuildQuest(characters: new[]
            {
                CharacterWithDialogue(new QuestCharacterDialogueAsset[0], graphWalked: true),
            }),
        });
        var extractor = new QuestExtractor(source);

        var row = Assert.Single(extractor.Walk());

        Assert.Empty(Assert.Single(row.Fields.Characters).Dialogue);
        var diagnostic = Assert.Single(extractor.Diagnostics, item => item.Code == "questCharacterDialogueGraphEmpty");
        Assert.Equal("diagnostic", diagnostic.Severity);
        Assert.Equal("characters.dialogue", diagnostic.Field);
    }

    private static QuestCharacterAsset CharacterWithDialogue(
        IReadOnlyList<QuestCharacterDialogueAsset>? dialogue,
        bool graphWalked = true) =>
        new(
            3,
            "Quest giver",
            "Character",
            SnapshotRef.Record("instances", "characters", "0123456789abcdef0123456789abcdef", "CharacterRecord"),
            Dialogue: dialogue,
            DialogueGraphWalked: graphWalked);

    private static QuestAsset BuildQuest(
        IReadOnlyList<QuestPhaseAsset>? phases = null,
        IReadOnlyList<QuestCharacterAsset>? characters = null,
        IReadOnlyList<QuestRewardSetAsset>? rewardSets = null) => new(
        AssetName: "quest_phases",
        QuestGameId: "quest-game-id",
        QuestName: "Test quest",
        QuestSubname: "Subname",
        Disabled: false,
        HiddenInQuestUi: false,
        JournalOnStart: null,
        JournalOnSucceed: null,
        JournalOnFailure: null,
        RequiredCharacterRefs: new List<SnapshotRef>(),
        Phases: phases ?? new List<QuestPhaseAsset>(),
        Characters: characters ?? new List<QuestCharacterAsset>(),
        JournalEntries: new List<QuestJournalAsset>(),
        RewardSets: rewardSets ?? new List<QuestRewardSetAsset>());

    private sealed class FakeQuestAssetSource : IQuestAssetSource
    {
        private readonly IReadOnlyList<QuestAsset> _assets;

        public FakeQuestAssetSource(IReadOnlyList<QuestAsset> assets)
        {
            _assets = assets;
        }

        public IEnumerable<QuestAsset> EnumerateQuests() => _assets;
    }
}
