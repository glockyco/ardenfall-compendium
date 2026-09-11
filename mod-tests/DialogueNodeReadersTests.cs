using ArdenfallCompendium.Entities.Dialogue;
using Xunit;

namespace ArdenfallCompendium.Tests;

public class DialogueNodeReadersTests
{
    [Theory]
    [InlineData("SpeakFlowNode", "speech")]
    [InlineData("GreetingFlowNode", "speech")]
    [InlineData("TopicFlowNode", "choice")]
    [InlineData("MultipleChoiceFlowNode", "choice")]
    [InlineData("BranchRelationshipNode", "branch")]
    [InlineData("FactionCheck", "condition")]
    [InlineData("XPNode", "effect")]
    [InlineData("GoToLastMultipleChoice", "jump")]
    [InlineData("FinishDialogFlowNode", "end")]
    public void MapsAnAuthoredTypeToTheRoleAReaderNeeds(string authoredType, string role)
    {
        Assert.Equal(role, DialogueNodeReaders.RoleOf(authoredType));
    }

    [Fact]
    public void ReportsATypeItDoesNotReadRatherThanGuessingARole()
    {
        // The build authors 147 node types in its dialogue graphs, and the next build will author
        // more. An unread type publishes as unmodelled, which the export counts.
        Assert.Equal("unmodelled", DialogueNodeReaders.RoleOf("SomeNodeTypeTheNextBuildAdds"));
    }

    [Fact]
    public void NamesTheRoutingTypesThatCarryNothingAReaderNeeds()
    {
        Assert.True(DialogueNodeReaders.IsControl("GoToStatement"));
        Assert.True(DialogueNodeReaders.IsControl("SetVariable`1"));
        Assert.True(DialogueNodeReaders.IsControl("CustomFunctionCall"));
    }

    [Fact]
    public void KeepsSpeechAndChoiceOutOfTheRoutingSet()
    {
        // A contracted node disappears into an edge, so a type that carries prose must never be
        // treated as routing.
        Assert.False(DialogueNodeReaders.IsControl("SpeakFlowNode"));
        Assert.False(DialogueNodeReaders.IsControl("TopicFlowNode"));
        Assert.False(DialogueNodeReaders.IsControl("FinishDialogFlowNode"));
    }
}
