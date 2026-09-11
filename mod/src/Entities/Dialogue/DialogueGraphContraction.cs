using System.Collections.Generic;

namespace ArdenfallCompendium.Entities.Dialogue;

/// <summary>One authored edge, before contraction.</summary>
public readonly struct AuthoredDialogueEdge
{
    public AuthoredDialogueEdge(int source, int target, string port)
    {
        Source = source;
        Target = target;
        Port = port;
    }

    public int Source { get; }

    public int Target { get; }

    /// <summary>The output the edge leaves from: an option port, or a branch label.</summary>
    public string Port { get; }
}

/// <summary>
/// Joins the authored edges of a graph into the edges a reader needs.
/// </summary>
/// <remarks>
/// A control node carries no text, no gate and no outcome, and control nodes are 27 percent of this
/// build's dialogue nodes. The contraction joins each inbound edge of a control node to each of its
/// outbound edges, so a published edge always joins two nodes a reader cares about.
///
/// The graph holds cycles: 949 of its nodes jump back to an earlier point, and 1,383 nodes have more
/// than one inbound edge. The search therefore visits a node once per source and stops at the first
/// published node it reaches.
///
/// Plain integers keep this testable. The walk supplies the ids, the ports and the two sets.
/// </remarks>
public static class DialogueGraphContraction
{
    public static List<AuthoredDialogueEdge> Contract(
        IEnumerable<AuthoredDialogueEdge> authored,
        IReadOnlyCollection<int> published,
        IReadOnlyCollection<int> control)
    {
        var outgoing = new Dictionary<int, List<AuthoredDialogueEdge>>();
        foreach (var edge in authored)
        {
            if (!outgoing.TryGetValue(edge.Source, out var list))
            {
                list = new List<AuthoredDialogueEdge>();
                outgoing[edge.Source] = list;
            }

            list.Add(edge);
        }

        var publishedSet = new HashSet<int>(published);
        var controlSet = new HashSet<int>(control);
        var contracted = new List<AuthoredDialogueEdge>();

        foreach (var source in published)
        {
            // Keyed by the port as well as the node, because several options of one choice reach the
            // same control node: four of five options of one choice enter the same `GoToStatement`,
            // and a node-only guard published the first and dropped the other three, which left
            // those options looking like choices that lead nowhere.
            var seen = new HashSet<(int Target, string Port)>();
            var pending = new Queue<AuthoredDialogueEdge>();
            foreach (var edge in Edges(outgoing, source)) pending.Enqueue(edge);

            while (pending.Count > 0)
            {
                var edge = pending.Dequeue();
                if (!seen.Add((edge.Target, edge.Port))) continue;
                if (publishedSet.Contains(edge.Target))
                {
                    contracted.Add(new AuthoredDialogueEdge(source, edge.Target, edge.Port));
                    continue;
                }

                if (!controlSet.Contains(edge.Target)) continue;
                foreach (var next in Edges(outgoing, edge.Target))
                {
                    // The port of the first edge is the one a reader needs. It names the option or
                    // the branch output the flow left from, and the control nodes between carry none.
                    pending.Enqueue(new AuthoredDialogueEdge(source, next.Target, edge.Port));
                }
            }
        }

        return contracted;
    }

    private static IEnumerable<AuthoredDialogueEdge> Edges(
        Dictionary<int, List<AuthoredDialogueEdge>> outgoing,
        int source) =>
        outgoing.TryGetValue(source, out var list) ? list : System.Array.Empty<AuthoredDialogueEdge>();
}
