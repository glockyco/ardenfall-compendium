using ArdenfallCompendium.Dtos;
using Newtonsoft.Json;
using System.Collections.Generic;

namespace ArdenfallCompendium.Entities.Dialogue;

/// <summary>One object that reaches a conversation.</summary>
public sealed class DialogueHolderFields
{
    /// <summary>
    /// How the game reaches the graph: `character`, `character-module`, `quest-character`,
    /// `quest-character-group`, `quest-scene-object`, or `scene-placement`.
    /// </summary>
    [JsonProperty("kind")] public string Kind { get; set; } = "";

    /// <summary>The published entity that holds the graph, when the holder is one.</summary>
    [JsonProperty("ref")] public SnapshotRef? Ref { get; set; }

    /// <summary>What the game calls the holder, for a holder with no page of its own.</summary>
    [JsonProperty("label")] public string? Label { get; set; }
}

/// <summary>One authored conversation, with the graph it holds and every holder that reaches it.</summary>
public sealed class DialogueFields
{
    [JsonProperty("id")] public string Id { get; set; } = "";

    [JsonProperty("graphName")] public string GraphName { get; set; } = "";

    [JsonProperty("nodes")] public List<DialogueNodeSnapshot> Nodes { get; set; } = new();

    [JsonProperty("edges")] public List<DialogueEdgeSnapshot> Edges { get; set; } = new();

    [JsonProperty("entryNodes")] public List<int> EntryNodes { get; set; } = new();

    [JsonProperty("holders")] public List<DialogueHolderFields> Holders { get; set; } = new();
}

/// <summary>
/// The identity of a conversation.
/// </summary>
/// <remarks>
/// The graph asset owns it. A placement carries no `GuidComponent` in 8 of this build's 27 scene
/// placements, and a graph the game reaches from two holders is one conversation, so neither the
/// placement nor the holder can be the identity.
///
/// A graph name is not unique. This build ships 231 authored graphs under 211 names, because a
/// quest reuses a generic name such as `questdialog_quest-giver` for its own graph. The quest the
/// graph names as its owner separates them, and makes all 231 distinct.
/// </remarks>
public static class DialogueIds
{
    public static string Conversation(string graphName, string? ownerName) =>
        string.IsNullOrEmpty(ownerName)
            ? $"named;dialog;{graphName}"
            : $"named;dialog;{ownerName}/{graphName}";
}
