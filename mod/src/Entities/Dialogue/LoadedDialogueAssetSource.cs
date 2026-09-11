using System;
using System.Collections.Generic;
using System.Linq;
using Ardenfall;
using Ardenfall.Dialog;
using Ardenfall.Nodes;
using Ardenfall.Questing;
using ArdenfallCompendium.Dtos;
using UnityObject = UnityEngine.Object;

namespace ArdenfallCompendium.Entities.Dialogue;

/// <summary>What the source produced, so a caller can publish rows and report coverage.</summary>
public sealed record DialogueAssetSourceResult(
    IReadOnlyList<DialogueFields> Conversations,
    IReadOnlyDictionary<string, int> HoldersByKind,
    IReadOnlyDictionary<string, int> UnmodelledTypes,
    IReadOnlyList<Diagnostic> Diagnostics);

/// <summary>
/// Reads every conversation the loaded assets hold.
/// </summary>
/// <remarks>
/// The game authors dialogue in five places besides a scene placement, and an export that opens one
/// of them publishes a ninth of the corpus. A holder differs only in how its graph is reached, so
/// each one contributes an adapter here and the walk does the rest.
///
/// A graph reached from several holders is one conversation. The source merges the holders onto the
/// conversation and walks the graph once, because the nodes are the same asset whichever object
/// points at it.
/// </remarks>
public sealed class LoadedDialogueAssetSource : IDialogueAssetSource
{
    private readonly Func<IEnumerable<CharacterData>> _loadedCharacters;
    private readonly Func<IEnumerable<QuestData>> _loadedQuests;

    public LoadedDialogueAssetSource()
        : this(
            () => UnityEngine.Resources.FindObjectsOfTypeAll<CharacterData>(),
            () => UnityEngine.Resources.FindObjectsOfTypeAll<QuestData>())
    {
    }

    public LoadedDialogueAssetSource(
        Func<IEnumerable<CharacterData>> loadedCharacters,
        Func<IEnumerable<QuestData>> loadedQuests)
    {
        _loadedCharacters = loadedCharacters;
        _loadedQuests = loadedQuests;
    }

    public DialogueAssetSourceResult Read()
    {
        var conversations = new Dictionary<string, DialogueFields>(StringComparer.Ordinal);
        var holdersByKind = new Dictionary<string, int>(StringComparer.Ordinal);
        var unmodelled = new Dictionary<string, int>(StringComparer.Ordinal);
        var diagnostics = new List<Diagnostic>();

        foreach (var character in _loadedCharacters())
        {
            if (character == null) continue;
            var holder = new DialogueHolderFields
            {
                Kind = "character",
                Ref = SnapshotRef.NamedAsset("character", character.name),
                Label = character.name,
            };
            foreach (var graph in CharacterGraphs(character))
            {
                Add(conversations, holdersByKind, unmodelled, diagnostics, graph, holder);
            }

            foreach (var module in Modules(character))
            {
                var moduleHolder = new DialogueHolderFields
                {
                    Kind = "character-module",
                    Ref = SnapshotRef.NamedAsset("character", character.name),
                    Label = module.name,
                };
                foreach (var graph in ModuleGraphs(module))
                {
                    Add(conversations, holdersByKind, unmodelled, diagnostics, graph, moduleHolder);
                }
            }
        }

        foreach (var quest in _loadedQuests())
        {
            if (quest == null) continue;
            foreach (var (graph, kind, label) in QuestGraphs(quest))
            {
                var holder = new DialogueHolderFields
                {
                    Kind = kind,
                    Ref = DialogueRefs.Asset(quest, "QuestData"),
                    Label = label,
                };
                Add(conversations, holdersByKind, unmodelled, diagnostics, graph, holder);
            }
        }

        return new DialogueAssetSourceResult(
            conversations.Values.OrderBy(row => row.Id, StringComparer.Ordinal).ToList(),
            holdersByKind,
            unmodelled,
            diagnostics);
    }

    private static void Add(
        Dictionary<string, DialogueFields> conversations,
        Dictionary<string, int> holdersByKind,
        Dictionary<string, int> unmodelled,
        List<Diagnostic> diagnostics,
        DialogFlowGraph graph,
        DialogueHolderFields holder)
    {
        holdersByKind.TryGetValue(holder.Kind, out var holderCount);
        holdersByKind[holder.Kind] = holderCount + 1;

        var id = DialogueIds.Conversation(graph.name);
        if (conversations.TryGetValue(id, out var existing))
        {
            existing.Holders.Add(holder);
            return;
        }

        var walked = DialogueGraphWalk.Walk(graph, out _);
        diagnostics.AddRange(walked.Diagnostics);
        foreach (var pair in walked.UnmodelledTypes)
        {
            unmodelled.TryGetValue(pair.Key, out var seen);
            unmodelled[pair.Key] = seen + pair.Value;
        }

        conversations[id] = new DialogueFields
        {
            Id = id,
            GraphName = graph.name,
            Nodes = walked.Nodes,
            Edges = walked.Edges,
            EntryNodes = walked.EntryNodes,
            Holders = { holder },
        };
    }

    /// <summary>
    /// The dialogue graphs a character definition holds.
    /// </summary>
    /// <remarks>
    /// `CharacterGraphContainer` inherits its `graph` from a generic base as a field, so a reflective
    /// read looks through the hierarchy. A container may hold an object flow graph rather than a
    /// dialogue one, and only the dialogue graphs carry prose.
    /// </remarks>
    private static IEnumerable<DialogFlowGraph> CharacterGraphs(CharacterData character) =>
        Graphs(character.characterGraphs?.Get());

    private static IEnumerable<CharacterModule> Modules(CharacterData character)
    {
        var modules = character.modules?.Get();
        return modules == null
            ? Array.Empty<CharacterModule>()
            : modules.Where(module => module != null)!;
    }

    private static IEnumerable<DialogFlowGraph> ModuleGraphs(CharacterModule module) =>
        Graphs(module.characterGraphs?.Get());

    private static IEnumerable<DialogFlowGraph> Graphs(IEnumerable<CharacterGraphContainer>? containers)
    {
        if (containers == null) yield break;
        foreach (var container in containers)
        {
            if (container == null) continue;
            if (GraphFields.Read<UnityObject>(container, "graph") is DialogFlowGraph graph)
            {
                yield return graph;
            }
        }
    }

    /// <summary>The three quest holders, each of which points at a graph of its own.</summary>
    private static IEnumerable<(DialogFlowGraph Graph, string Kind, string? Label)> QuestGraphs(
        QuestData quest)
    {
        var objects = quest.objects;
        if (objects == null) yield break;
        foreach (var questObject in objects)
        {
            switch (questObject)
            {
                case CharacterQuestObject character
                    when character.dialogGraph?.flowGraph?.graph is DialogFlowGraph characterGraph:
                    yield return (characterGraph, "quest-character", character.objectName);
                    break;
                case CharacterGroupQuestObject group
                    when group.dialogGraph?.flowGraph?.graph is DialogFlowGraph groupGraph:
                    yield return (groupGraph, "quest-character-group", group.objectName);
                    break;
                case SimpleDialogSceneQuestObject scene
                    when scene.dialogGraph?.flowGraph?.graph is DialogFlowGraph sceneGraph:
                    yield return (sceneGraph, "quest-scene-object", scene.objectName);
                    break;
            }
        }
    }
}
