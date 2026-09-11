using System;
using System.Collections.Generic;
using Ardenfall;
using Ardenfall.Dialog;
using ArdenfallCompendium.Entities.Dialogue;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.World;

/// <summary>One place a reader can start a conversation.</summary>
public sealed class SceneDialoguePlacementFields
{
    [JsonProperty("cell")] public string Cell { get; set; } = "";

    [JsonProperty("map")] public string? Map { get; set; }

    [JsonProperty("position")] public ScenePosition Position { get; set; } = new();

    /// <summary>The authored speaker name, or null when the game gives the speaker none.</summary>
    [JsonProperty("speakerName")] public string? SpeakerName { get; set; }

    /// <summary>The prompt the player reads before interacting.</summary>
    [JsonProperty("interactionText")] public string? InteractionText { get; set; }
}

/// <summary>Where a scene lets a reader start one conversation.</summary>
public sealed class SceneDialogueFields
{
    [JsonProperty("id")] public string Id { get; set; } = "";

    /// <summary>The conversation these placements start.</summary>
    [JsonProperty("dialogueId")] public string DialogueId { get; set; } = "";

    [JsonProperty("graphName")] public string GraphName { get; set; } = "";

    [JsonProperty("placements")]
    public List<SceneDialoguePlacementFields> Placements { get; set; } =
        new();
}

/// <summary>
/// Publishes the dialogue a scene places: the graphs held by `SimpleDialogInteractable`.
/// </summary>
/// <remarks>
/// The family writes two rows for one object. The conversation goes to the `dialogue` family, which
/// every holder shares, and the placements stay here, because a placement is a point on a map and a
/// conversation is not.
///
/// The cell walk is one producer of conversations. A character definition and a quest reach graphs of
/// their own, which the extraction reads from the loaded assets, so the canonicaliser merges rows
/// that share a conversation id.
///
/// An interactable that references no graph publishes no dialogue, because it carries no authored
/// line. A diagnostic counts it, so the absence is measured rather than silent.
/// </remarks>
public sealed class SceneDialogueFamily : ISceneFamily
{
    public string EntityId => "scene-dialogue";

    public IEnumerable<Type> ComponentTypes => new[] { typeof(SimpleDialogInteractable) };

    public void Harvest(CellScene cell, string? map, CellHarvest harvest)
    {
        var placementRows = harvest.RowsFor(EntityId);
        var dialogueRows = harvest.RowsFor("dialogue");
        var speakers = SceneObjects.InCell<SimpleDialogInteractable>(cell);
        harvest.ObjectsSeen += speakers.Count;

        var placementsByGraph = new Dictionary<string, SceneRow>(StringComparer.Ordinal);
        var conversationsByGraph = new Dictionary<string, SceneRow>(StringComparer.Ordinal);
        var withoutGraph = 0;
        var nameless = 0;

        foreach (var speaker in speakers)
        {
            var graphs = GraphsOf(speaker);
            if (graphs.Count == 0)
            {
                withoutGraph++;
                continue;
            }

            var speakerName = string.IsNullOrWhiteSpace(speaker.dialogName)
                ? null
                : speaker.dialogName;
            if (speakerName == null) nameless++;
            var position = speaker.transform.position;

            foreach (var graph in graphs)
            {
                var id = DialogueIds.Conversation(graph.name);
                AddConversation(conversationsByGraph, dialogueRows, harvest, graph, speakerName);

                if (!placementsByGraph.TryGetValue(id, out var row))
                {
                    row = new SceneRow(id, new SceneDialogueFields
                    {
                        Id = id,
                        DialogueId = id,
                        GraphName = graph.name,
                    });
                    placementsByGraph[id] = row;
                    placementRows.Add(row);
                }

                ((SceneDialogueFields)row.Fields).Placements.Add(new SceneDialoguePlacementFields
                {
                    Cell = cell.Name,
                    Map = map,
                    Position = new ScenePosition(position.x, position.y, position.z),
                    SpeakerName = speakerName,
                    InteractionText = string.IsNullOrWhiteSpace(speaker.interactableText)
                        ? null
                        : speaker.interactableText,
                });
            }
        }

        if (withoutGraph > 0)
        {
            harvest.Diagnostics.Add(new Dtos.Diagnostic
            {
                Severity = "diagnostic",
                Code = "sceneDialogueWithoutGraph",
                Field = "dialogs",
                Message =
                    $"{withoutGraph} SimpleDialogInteractable in cell '{cell.Name}' reference no dialogue graph and publish no line.",
            });
        }

        if (nameless > 0)
        {
            harvest.Diagnostics.Add(new Dtos.Diagnostic
            {
                Severity = "diagnostic",
                Code = "sceneDialogueSpeakerNameMissing",
                Field = "speakerName",
                Message =
                    $"{nameless} dialogue placement in cell '{cell.Name}' carries no authored dialogName.",
            });
        }
    }

    private static void AddConversation(
        Dictionary<string, SceneRow> byGraph,
        List<SceneRow> rows,
        CellHarvest harvest,
        DialogFlowGraph graph,
        string? speakerName)
    {
        var id = DialogueIds.Conversation(graph.name);
        if (byGraph.TryGetValue(id, out var existing))
        {
            AddHolder((DialogueFields)existing.Fields, speakerName);
            return;
        }

        var walked = DialogueGraphWalk.Walk(graph, out _);
        var fields = new DialogueFields
        {
            Id = id,
            GraphName = graph.name,
            Nodes = walked.Nodes,
            Edges = walked.Edges,
            EntryNodes = walked.EntryNodes,
        };
        AddHolder(fields, speakerName);

        var row = new SceneRow(id, fields);
        row.Diagnostics.AddRange(walked.Diagnostics);
        byGraph[id] = row;
        rows.Add(row);
        harvest.Diagnostics.AddRange(walked.Diagnostics);
    }

    private static void AddHolder(DialogueFields fields, string? speakerName)
    {
        fields.Holders.Add(new DialogueHolderFields
        {
            Kind = "scene-placement",
            Label = speakerName,
        });
    }

    private static List<DialogFlowGraph> GraphsOf(SimpleDialogInteractable speaker)
    {
        var graphs = new List<DialogFlowGraph>();
        if (speaker.dialogs == null) return graphs;
        foreach (var graph in speaker.dialogs)
        {
            if (graph == null) continue;
            graphs.Add(graph);
        }

        return graphs;
    }
}
