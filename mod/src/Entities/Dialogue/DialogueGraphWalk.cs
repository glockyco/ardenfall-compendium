using System.Collections.Generic;
using System.Linq;
using Ardenfall.Dialog;
using ArdenfallCompendium.Dtos;
using FlowCanvas;
using FlowCanvas.Nodes;
using NodeCanvas.Framework;

namespace ArdenfallCompendium.Entities.Dialogue;

/// <summary>
/// Reads one dialogue graph as published data: nodes with a role, and the authored edges between
/// them.
/// </summary>
/// <remarks>
/// Every holder of authored dialogue reads through this walk, so a reader sees the same conversation
/// whichever object owns the graph.
///
/// The walk publishes structure and never a path. It resolves no gate and picks no branch, because
/// the branch taken depends on a save. The authored edges, the gates and the outcomes are all
/// authored fields, and those are what it reads.
///
/// Two node groups never reach a reader. A control node carries no text, no gate and no outcome, and
/// control nodes are 27 percent of this build's dialogue nodes, so the walk joins their inbound edges
/// to their outbound edges. A `GoToStatement` and its `GoToLabel` are a wire: the walk follows the
/// label reference and publishes the edge the pair stands for, which is also how a conversation's
/// loops become ordinary edges.
///
/// Topics read their authored `statement` field rather than <c>ITopicNode.GetTopicStatements</c>,
/// which consults live graph state through <c>IsNodeChoiceEntered</c> and <c>ApplyModifiers</c>. That
/// field is also the text a reader wants: source prose, before the runtime rewrites it.
/// </remarks>
public static class DialogueGraphWalk
{
    /// <param name="walked">
    /// True when a graph was present and its nodes were enumerated, whatever the walk yielded.
    /// Distinguishes "this object has no dialogue" from "a graph produced no nodes".
    /// </param>
    public static DialogueGraphSnapshot Walk(DialogFlowGraph? graph, out bool walked)
    {
        walked = false;
        var snapshot = new DialogueGraphSnapshot();
        var nodes = graph?.allNodes;
        if (graph == null || nodes == null) return snapshot;

        walked = true;
        snapshot.GraphName = graph.name;

        var published = new Dictionary<int, DialogueNodeSnapshot>();
        var control = new HashSet<int>();
        foreach (var node in nodes)
        {
            if (node == null) continue;
            var authoredType = node.GetType().Name;
            if (DialogueNodeReaders.IsControl(authoredType))
            {
                control.Add(node.ID);
                continue;
            }

            var read = DialogueNodeReaders.Read(node);
            published[node.ID] = read;
            if (read.Role == DialogueRoles.Unmodelled)
            {
                snapshot.UnmodelledTypes.TryGetValue(authoredType, out var seen);
                snapshot.UnmodelledTypes[authoredType] = seen + 1;
            }
        }

        foreach (var edge in DialogueGraphContraction.Contract(
            AuthoredEdges(nodes),
            published.Keys.ToList(),
            control))
        {
            snapshot.Edges.Add(new DialogueEdgeSnapshot
            {
                From = edge.Source,
                To = edge.Target,
                Ordinal = snapshot.Edges.Count(published => published.From == edge.Source),
                Port = string.IsNullOrEmpty(edge.Port) ? null : edge.Port,
            });
        }

        snapshot.Nodes.AddRange(published.Values.OrderBy(node => node.Id));
        var reached = new HashSet<int>(snapshot.Edges.Select(edge => edge.To));
        snapshot.EntryNodes.AddRange(
            snapshot.Nodes.Where(node => !reached.Contains(node.Id)).Select(node => node.Id));

        foreach (var pair in snapshot.UnmodelledTypes)
        {
            snapshot.Diagnostics.Add(new Diagnostic
            {
                Severity = "diagnostic",
                Code = "dialogueNodeUnmodelled",
                Field = "nodes",
                Message =
                    $"Dialogue graph '{graph.name}' holds {pair.Value} node(s) of type '{pair.Key}', which the walk does not read.",
            });
        }

        return snapshot;
    }

    /// <summary>Every authored edge of the graph, with the output port each one leaves from.</summary>
    private static List<AuthoredDialogueEdge> AuthoredEdges(IEnumerable<Node> nodes)
    {
        var edges = new List<AuthoredDialogueEdge>();
        foreach (var node in nodes)
        {
            if (node == null) continue;
            foreach (var connection in node.outConnections)
            {
                var target = connection?.targetNode;
                if (target == null) continue;
                // A `BinderConnection` names the output port it leaves from, which is how an option
                // of a multiple choice, or a tier of a relationship branch, keeps its label.
                var port = connection is BinderConnection binder ? binder.sourcePortID ?? "" : "";
                edges.Add(new AuthoredDialogueEdge(node.ID, target.ID, port));
            }

            // A `GoToStatement` carries its target as a node reference rather than as a connection.
            // Following it turns a conversation's loop into an ordinary edge.
            if (node is GoToStatement jump)
            {
                var label = jump._targetLabel?.Get(node.graph);
                if (label != null) edges.Add(new AuthoredDialogueEdge(node.ID, label.ID, ""));
            }
        }

        return edges;
    }
}
