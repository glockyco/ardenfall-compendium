using System;
using System.Collections.Generic;
using Ardenfall;
using Ardenfall.Dialog;
using ArdenfallCompendium.Entities.Dialogue;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.World;

/// <summary>One authored line a dialogue graph holds.</summary>
public sealed class SceneDialogueLineFields
{
    [JsonProperty("lineOrdinal")] public int LineOrdinal { get; set; }

    /// <summary>`greeting` is spoken; `topic` is something a reader can ask about.</summary>
    [JsonProperty("kind")] public string Kind { get; set; } = "";

    [JsonProperty("text")] public string Text { get; set; } = "";

    [JsonProperty("importance")] public int Importance { get; set; }
}

/// <summary>One place a reader can start a dialogue.</summary>
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

/// <summary>One authored dialogue a scene places, with every placement that starts it.</summary>
public sealed class SceneDialogueFields
{
    [JsonProperty("id")] public string Id { get; set; } = "";

    [JsonProperty("graphName")] public string GraphName { get; set; } = "";

    [JsonProperty("lines")] public List<SceneDialogueLineFields> Lines { get; set; } = new();

    [JsonProperty("placements")]
    public List<SceneDialoguePlacementFields> Placements { get; set; } =
        new();
}

/// <summary>
/// Publishes the dialogue a scene places: the graphs held by `SimpleDialogInteractable`.
/// </summary>
/// <remarks>
/// The graph owns the identity, not the placement. A `SimpleDialogInteractable` is an ordinary
/// scene prop with a dialogue component, and 8 of this build's 27 placements carry no
/// `GuidComponent` on themselves or any ancestor, including both signs whose graph holds the demo
/// teleporter conversation. Keying on the placement dropped exactly those, and it split one
/// conversation into a page per copy.
///
/// Lines are read through <see cref="DialogueGraphWalk"/>, the traversal quest dialogue uses, so a
/// reader sees one dialogue contract whichever object owns the graph.
///
/// An interactable that references no graph publishes no dialogue, because it carries no authored
/// line. It is counted in a diagnostic, so the absence is measured rather than silent.
/// </remarks>
public sealed class SceneDialogueFamily : ISceneFamily
{
    public string EntityId => "scene-dialogue";

    public IEnumerable<Type> ComponentTypes => new[] { typeof(SimpleDialogInteractable) };

    public void Harvest(CellScene cell, string? map, CellHarvest harvest)
    {
        var rows = harvest.RowsFor(EntityId);
        var speakers = SceneObjects.InCell<SimpleDialogInteractable>(cell);
        harvest.ObjectsSeen += speakers.Count;

        // One row per graph within this cell. A graph placed in several cells yields a row per
        // batch, which the canonicaliser merges on the shared id.
        var byGraph = new Dictionary<string, SceneRow>(StringComparer.Ordinal);
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
                var id = DialogueId(graph.name);
                if (!byGraph.TryGetValue(id, out var row))
                {
                    row = new SceneRow(id, new SceneDialogueFields
                    {
                        Id = id,
                        GraphName = graph.name,
                        Lines = Lines(graph),
                    });
                    byGraph[id] = row;
                    rows.Add(row);
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
                Field = "dialogName",
                Message =
                    $"{nameless} dialogue placement in cell '{cell.Name}' carries no authored dialogName.",
            });
        }
    }

    /// <summary>An id that declares the mechanism that produced it, like the named assets do.</summary>
    public static string DialogueId(string graphName) => $"named;dialog;{graphName}";

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

    private static List<SceneDialogueLineFields> Lines(DialogFlowGraph graph)
    {
        var lines = new List<SceneDialogueLineFields>();
        foreach (var line in DialogueGraphWalk.Walk(graph, out _))
        {
            lines.Add(new SceneDialogueLineFields
            {
                LineOrdinal = line.LineOrdinal,
                Kind = line.Kind,
                Text = line.Text,
                Importance = line.Importance,
            });
        }

        return lines;
    }
}
