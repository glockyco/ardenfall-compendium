using System.Collections.Generic;
using System.Linq;
using ArdenfallCompendium.Entities.Dialogue;
using Xunit;

namespace ArdenfallCompendium.Tests;

public class DialogueGraphContractionTests
{
    [Fact]
    public void JoinsTwoPublishedNodesThroughAChainOfRouting()
    {
        // 1 speaks, 4 is a choice, and 2 and 3 are routing. A reader needs one edge.
        var contracted = DialogueGraphContraction.Contract(
            new[] { Edge(1, 2), Edge(2, 3), Edge(3, 4) },
            published: new[] { 1, 4 },
            control: new[] { 2, 3 });

        var edge = Assert.Single(contracted);
        Assert.Equal(1, edge.Source);
        Assert.Equal(4, edge.Target);
    }

    [Fact]
    public void KeepsThePortOfTheEdgeThatLeftTheSource()
    {
        // The option a choice leaves from is named on the first edge. The routing between carries
        // no port, so a reader would lose the option without this.
        var contracted = DialogueGraphContraction.Contract(
            new[] { Edge(1, 2, "3"), Edge(2, 5) },
            published: new[] { 1, 5 },
            control: new[] { 2 });

        Assert.Equal("3", Assert.Single(contracted).Port);
    }

    [Fact]
    public void KeepsEveryInboundEdgeOfAJoin()
    {
        // 1,383 nodes in this build have more than one inbound edge. Dropping one would silently
        // detach a reply from the choice that reaches it.
        var contracted = DialogueGraphContraction.Contract(
            new[] { Edge(1, 3), Edge(2, 3) },
            published: new[] { 1, 2, 3 },
            control: new int[0]);

        Assert.Equal(2, contracted.Count(edge => edge.Target == 3));
    }

    [Fact]
    public void PublishesALoopAsAnOrdinaryEdge()
    {
        // A conversation that returns to its choice list is a cycle, not a repeated subtree.
        var contracted = DialogueGraphContraction.Contract(
            new[] { Edge(1, 2), Edge(2, 3), Edge(3, 1) },
            published: new[] { 1, 2, 3 },
            control: new int[0]);

        Assert.Contains(contracted, edge => edge.Source == 3 && edge.Target == 1);
    }

    [Fact]
    public void TerminatesOnACycleOfRoutingNodes()
    {
        var contracted = DialogueGraphContraction.Contract(
            new[] { Edge(1, 2), Edge(2, 3), Edge(3, 2) },
            published: new[] { 1 },
            control: new[] { 2, 3 });

        Assert.Empty(contracted);
    }

    [Fact]
    public void DropsAnEdgeIntoANodeThatIsNeitherPublishedNorRouting()
    {
        // A node the walk refused to publish, such as one with no id, must not leave a dangling edge
        // that names a node the snapshot does not carry.
        var contracted = DialogueGraphContraction.Contract(
            new[] { Edge(1, 9) },
            published: new[] { 1 },
            control: new int[0]);

        Assert.Empty(contracted);
    }

    private static AuthoredDialogueEdge Edge(int source, int target, string port = "") =>
        new(source, target, port);
}

public class SharedControlNodeTests
{
    [Fact]
    public void EveryOptionThroughOneControlNodeKeepsItsEdge()
    {
        // Four options of one choice enter the same jump node, which reaches a published reply.
        var authored = new List<AuthoredDialogueEdge>
        {
            new(1, 2, "0"),
            new(1, 2, "1"),
            new(1, 2, "2"),
            new(1, 3, "3"),
            new(2, 4, ""),
        };

        var contracted = DialogueGraphContraction.Contract(authored, new[] { 1, 3, 4 }, new[] { 2 });

        Assert.Equal(
            new[] { "0", "1", "2" },
            contracted.Where(edge => edge.Target == 4).Select(edge => edge.Port).OrderBy(port => port).ToArray());
        Assert.Single(contracted.Where(edge => edge.Target == 3));
    }
}
