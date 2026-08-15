using System.Collections.Generic;
using System.Linq;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities;
using ArdenfallCompendium.Entities.Character;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class CharacterExtractorTests
{
    [Fact]
    public void CharacterParentRefIsEmittedWithoutChangingExistingValues()
    {
        var parentRef = SnapshotRef.NamedAsset("character", "Base guard");
        var extractor = new CharacterExtractor(new FakeSource(new CharacterAsset(
            "guard",
            "Guard",
            null,
            null,
            ParentRef: parentRef,
            RaceRef: RaceRef())));

        var row = Assert.Single(extractor.Walk());

        Assert.Equal("Guard", row.Fields.Name);
        var resolvedParent = Assert.IsType<SnapshotRef>(row.Fields.ParentRef);
        Assert.Equal("namedAsset", resolvedParent.Kind);
        Assert.Equal("character", resolvedParent.Entity);
        Assert.Equal("Base guard", resolvedParent.Name);
    }

    [Fact]
    public void CharacterRaceRefIsEmitted()
    {
        var extractor = new CharacterExtractor(new FakeSource(
            new CharacterAsset("guard", "Guard", null, null, RaceRef: RaceRef())));

        var row = Assert.Single(extractor.Walk());

        var race = Assert.IsType<SnapshotRef>(row.Fields.RaceRef);
        Assert.Equal("namedAsset", race.Kind);
        Assert.Equal("character-race", race.Entity);
        Assert.Equal("race_karu_elf", race.Name);
        Assert.Empty(extractor.Diagnostics);
    }

    [Fact]
    public void CharacterWithoutRaceEmitsDiagnosticAndNullRef()
    {
        var extractor = new CharacterExtractor(new FakeSource(
            new CharacterAsset("mannequin", "Mannequin", null, null)));

        var row = Assert.Single(extractor.Walk());

        Assert.Null(row.Fields.RaceRef);
        var diagnostic = Assert.Single(extractor.Diagnostics);
        Assert.Equal("characterRaceMissing", diagnostic.Code);
        Assert.Equal("raceRef", diagnostic.Field);
    }

    [Fact]
    public void CharacterWithoutParentEmitsMissingParentRef()
    {
        var extractor = new CharacterExtractor(new FakeSource(
            new CharacterAsset("guard", "Guard", null, null, RaceRef: RaceRef())));

        var row = Assert.Single(extractor.Walk());

        Assert.Equal("Guard", row.Fields.Name);
        Assert.Equal("missing", row.Fields.ParentRef.Kind);
        Assert.Equal("noParent", row.Fields.ParentRef.Reason);
        Assert.Equal("ParameterizedObject.parent", row.Fields.ParentRef.Source);
    }

    [Fact]
    public void FlatListYieldsEveryItem()
    {
        var list = List("sword", "potion");

        var result = Walk(list);

        Assert.Equal(new[] { "sword", "potion" }, result);
    }

    [Fact]
    public void NestedListIsFlattened()
    {
        var nested = List("potion");
        var root = List(Entry.Nested(nested), Entry.Item("sword"));

        var result = Walk(root);

        Assert.Equal(new[] { "potion", "sword" }, result);
    }

    [Fact]
    public void SelfReferencingListTerminatesAndYieldsEachItemOnce()
    {
        var list = new ListNode();
        list.Groups.Add(new GroupNode(Entry.Item("sword"), Entry.Nested(list)));

        var result = Walk(list);

        Assert.Equal(new[] { "sword" }, result);
    }

    [Fact]
    public void DuplicatesAcrossListsAreDeduplicated()
    {
        var first = List("sword", "potion");
        var second = List("potion", "shield");

        var result = Walk(first, second);

        Assert.Equal(new[] { "sword", "potion", "shield" }, result);
    }

    [Fact]
    public void CharacterWithNoListsYieldsNoRefsAndNoDiagnostic()
    {
        var extractor = new CharacterExtractor(new FakeSource(
            new CharacterAsset("guard", "Guard", null, null, RaceRef: RaceRef())));

        var row = Assert.Single(extractor.Walk());

        Assert.Empty(row.Fields.DropRefs);
        Assert.Empty(extractor.Diagnostics);
    }

    [Fact]
    public void CharacterCarriesStartingFactionRefs()
    {
        var startingFaction = SnapshotRef.LookupAsset("faction-guid", "Ardenfall.Faction", "Black Moth");
        var extractor = new CharacterExtractor(new FakeSource(
            new CharacterAsset(
                "guard",
                "Guard",
                null,
                null,
                new[] { startingFaction },
                RaceRef: RaceRef())));

        var row = Assert.Single(extractor.Walk());

        var faction = Assert.Single(row.Fields.StartingFactions);
        Assert.Equal("faction-guid", faction.Guid);
        Assert.Equal("lookupAsset", faction.Kind);
    }

    [Fact]
    public void NamelessCharacterYieldsDiagnosticWithoutInventingName()
    {
        var extractor = new CharacterExtractor(new FakeSource(
            new CharacterAsset("guard", null, null, null, RaceRef: RaceRef())));

        var row = Assert.Single(extractor.Walk());

        Assert.Null(row.Fields.Name);
        var diagnostic = Assert.Single(extractor.Diagnostics);
        Assert.Equal("characterNameMissing", diagnostic.Code);
    }

    private static SnapshotRef RaceRef() =>
        SnapshotRef.NamedAsset("character-race", "race_karu_elf");

    private static string[] Walk(params ListNode[] roots) =>
        ItemListWalker.Flatten<ListNode, GroupNode, Entry, string>(
            roots,
            list => list.Groups,
            group => group.Entries,
            entry => entry.GroupEntries != null,
            entry => entry.GroupEntries ?? Enumerable.Empty<GroupNode>(),
            entry => entry.List != null,
            entry => entry.List,
            entry => entry.ItemValue).ToArray();

    private static ListNode List(params string[] items) =>
        List(items.Select(Entry.Item).ToArray());

    private static ListNode List(params Entry[] entries) =>
        new() { Groups = { new GroupNode(entries) } };

    private sealed class FakeSource : ICharacterAssetSource
    {
        private readonly IReadOnlyList<CharacterAsset> _assets;

        public FakeSource(params CharacterAsset[] assets) => _assets = assets;

        public IEnumerable<CharacterAsset> EnumerateCharacters() => _assets;
    }

    private sealed class ListNode
    {
        public List<GroupNode> Groups { get; } = new();
    }

    private sealed class GroupNode
    {
        public GroupNode(params Entry[] entries) => Entries.AddRange(entries);
        public List<Entry> Entries { get; } = new();
    }

    private sealed class Entry
    {
        public string? ItemValue { get; private init; }
        public ListNode? List { get; private init; }
        public List<GroupNode>? GroupEntries { get; private init; }

        public static Entry Item(string item) => new() { ItemValue = item };
        public static Entry Nested(ListNode list) => new() { List = list };
    }
}
