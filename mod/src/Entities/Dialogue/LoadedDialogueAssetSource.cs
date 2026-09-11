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
    private readonly Func<IEnumerable<DialogFlowGraph>> _loadedGraphs;

    public LoadedDialogueAssetSource()
        : this(
            // The registered assets, which is the set the compendium publishes characters from.
            // `Resources.FindObjectsOfTypeAll` also returns the runtime clones a loaded world
            // creates, and a holder named `preset_myst-elf_mercenary(Clone)(Clone)` resolves to no
            // page and inflates the corpus with copies of one conversation.
            BuiltLookupTable.GetAssetsOfType<CharacterData>,
            () => UnityEngine.Resources.FindObjectsOfTypeAll<QuestData>(),
            AuthoredGraphs)
    {
    }

    public LoadedDialogueAssetSource(
        Func<IEnumerable<CharacterData>> loadedCharacters,
        Func<IEnumerable<QuestData>> loadedQuests,
        Func<IEnumerable<DialogFlowGraph>> loadedGraphs)
    {
        _loadedCharacters = loadedCharacters;
        _loadedQuests = loadedQuests;
        _loadedGraphs = loadedGraphs;
    }

    /// <summary>
    /// The authored dialogue graphs of the build.
    /// </summary>
    /// <remarks>
    /// A loaded world holds a runtime copy of a graph per character that speaks it, named with
    /// `(Clone)`, and those copies are the same authored asset. The lookup table is not the
    /// population either: it registers 25 of this build's 239 authored graphs.
    /// </remarks>
    private static IEnumerable<DialogFlowGraph> AuthoredGraphs() =>
        UnityEngine.Resources.FindObjectsOfTypeAll<DialogFlowGraph>()
            .Where(graph => graph != null && !graph.name.Contains("(Clone)"));

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
                    Ref = SnapshotRef.NamedAsset("quest", quest.name),
                    Label = label,
                };
                Add(conversations, holdersByKind, unmodelled, diagnostics, graph, holder);
            }
        }

        // Every authored graph publishes, including one no holder names. A quest the graph itself
        // names is a holder; silence about the rest is measured rather than hidden, because the
        // game attaches many graphs to a character at runtime and the asset records no owner.
        var unheld = 0;
        foreach (var graph in _loadedGraphs())
        {
            var id = DialogueIds.Conversation(graph.name);
            if (conversations.ContainsKey(id)) continue;

            var attached = graph.AttachedQuest;
            if (attached != null)
            {
                Add(
                    conversations,
                    holdersByKind,
                    unmodelled,
                    diagnostics,
                    graph,
                    new DialogueHolderFields
                    {
                        Kind = "quest",
                        Ref = SnapshotRef.NamedAsset("quest", attached.name),
                        Label = attached.name,
                    });
                continue;
            }

            unheld++;
            Add(conversations, holdersByKind, unmodelled, diagnostics, graph, null);
        }

        if (unheld > 0)
        {
            diagnostics.Add(new Diagnostic
            {
                Severity = "diagnostic",
                Code = "dialogueHolderUnknown",
                Field = "holders",
                Message =
                    $"{unheld} authored dialogue graph(s) name no holder the extraction can read. The game attaches them to a character at runtime.",
            });
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
        DialogueHolderFields? holder)
    {
        if (holder != null)
        {
            holdersByKind.TryGetValue(holder.Kind, out var holderCount);
            holdersByKind[holder.Kind] = holderCount + 1;
        }

        var id = DialogueIds.Conversation(graph.name);
        if (conversations.TryGetValue(id, out var existing))
        {
            if (holder != null) existing.Holders.Add(holder);
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
            Holders = holder == null ? new List<DialogueHolderFields>() : new() { holder },
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
