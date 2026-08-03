using System.Collections.Generic;
using System.Linq;
using ArdenfallCompendium.Entities.Character;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class CharacterExtractorTests
{
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
            new CharacterAsset("guard", "Guard", null, null)));

        var row = Assert.Single(extractor.Walk());

        Assert.Empty(row.Fields.DropRefs);
        Assert.Empty(extractor.Diagnostics);
    }

    [Fact]
    public void NamelessCharacterYieldsDiagnosticWithoutInventingName()
    {
        var extractor = new CharacterExtractor(new FakeSource(
            new CharacterAsset("guard", null, null, null)));

        var row = Assert.Single(extractor.Walk());

        Assert.Null(row.Fields.Name);
        var diagnostic = Assert.Single(extractor.Diagnostics);
        Assert.Equal("characterNameMissing", diagnostic.Code);
    }

    private static string[] Walk(params ListNode[] roots) =>
        CharacterDropWalker.Flatten<ListNode, GroupNode, Entry, string>(
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
