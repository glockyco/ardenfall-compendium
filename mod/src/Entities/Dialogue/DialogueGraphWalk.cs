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

        // A graph carries two planes. Flow connections are the conversation, and value
        // connections feed a node's inputs, which is where a gate arrives: the greeting that
        // refuses to talk during combat reads `IsInBattleMode` through a value port, and treating
        // that as flow would put the check in the conversation instead of on the greeting.
        var authored = AuthoredEdges(nodes);
        foreach (var node in published.Values)
        {
            node.Gate ??= ValueGate(node.Id, authored.Value, nodes);
        }

        foreach (var edge in DialogueGraphContraction.Contract(
            authored.Flow,
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

    /// <summary>The two planes of a graph: the conversation, and the values its nodes read.</summary>
    private readonly struct AuthoredPlanes
    {
        public AuthoredPlanes(List<AuthoredDialogueEdge> flow, List<AuthoredDialogueEdge> value)
        {
            Flow = flow;
            Value = value;
        }

        public List<AuthoredDialogueEdge> Flow { get; }

        /// <summary>Value connections, from the node that produces a value to the node that reads it.</summary>
        public List<AuthoredDialogueEdge> Value { get; }
    }

    private static AuthoredPlanes AuthoredEdges(IEnumerable<Node> nodes)
    {
        var flow = new List<AuthoredDialogueEdge>();
        var value = new List<AuthoredDialogueEdge>();
        foreach (var node in nodes)
        {
            if (node == null) continue;
            foreach (var connection in node.outConnections)
            {
                var target = connection?.targetNode;
                if (target == null) continue;
                // A `BinderConnection` names the output port it leaves from, which is how an option
                // of a multiple choice, or a tier of a relationship branch, keeps its label.
                var binder = connection as BinderConnection;
                var port = binder?.sourcePortID ?? "";
                var edge = new AuthoredDialogueEdge(node.ID, target.ID, port);
                if (binder?.targetPort is ValueInput) value.Add(edge);
                else flow.Add(edge);
            }

            // A `GoToStatement` carries its target as a node reference rather than as a connection.
            // Following it turns a conversation's loop into an ordinary edge.
            if (node is GoToStatement jump)
            {
                var label = jump._targetLabel?.Get(node.graph);
                if (label != null) flow.Add(new AuthoredDialogueEdge(node.ID, label.ID, ""));
            }
        }

        return new AuthoredPlanes(flow, value);
    }

    /// <summary>
    /// The gate a node reads through its value inputs.
    /// </summary>
    /// <remarks>
    /// A check feeds the node it gates rather than sitting in the conversation. The search follows
    /// value connections backwards to the first node this walk can read as a condition. A chain of
    /// wrappers that reads live state, such as `PlayerCharacter.IsInBattleMode`, names no published
    /// subject, so it publishes as an unread gate rather than as no gate at all.
    /// </remarks>
    private static DialogueConditionSnapshot? ValueGate(
        int nodeId,
        List<AuthoredDialogueEdge> valueEdges,
        IEnumerable<Node> nodes)
    {
        var byId = nodes.Where(node => node != null).ToDictionary(node => node.ID);
        var seen = new HashSet<int> { nodeId };
        var pending = new Queue<int>();
        foreach (var edge in valueEdges.Where(edge => edge.Target == nodeId)) pending.Enqueue(edge.Source);

        var authoredChain = new List<string>();
        while (pending.Count > 0)
        {
            var current = pending.Dequeue();
            if (!seen.Add(current) || !byId.TryGetValue(current, out var node)) continue;
            var authoredType = node.GetType().Name;
            if (DialogueNodeReaders.RoleOf(authoredType) == DialogueRoles.Condition)
            {
                return DialogueNodeReaders.Read(node).Gate;
            }

            // The node's own title is what an author reads in the editor, such as
            // "Get Is In Battle Mode". It says more than the wrapper's type name.
            authoredChain.Add(string.IsNullOrWhiteSpace(node.name) ? authoredType : node.name);
            foreach (var edge in valueEdges.Where(edge => edge.Target == current))
            {
                pending.Enqueue(edge.Source);
            }
        }

        if (authoredChain.Count == 0) return null;
        return new DialogueConditionSnapshot
        {
            Kind = "unread",
            AuthoredType = string.Join(" → ", authoredChain),
        };
    }
}
