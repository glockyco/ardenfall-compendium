using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.Dialogue;

/// <summary>
/// What a reader needs a dialogue node to be.
/// </summary>
/// <remarks>
/// The build authors 147 node types in its dialogue graphs, and 53 of them appear three times or
/// less. A model with a case per type would carry 147 branches and would still miss the next build's
/// additions, so a node publishes one of these roles and its authored type name. A type this walk
/// does not read publishes as <see cref="Unmodelled"/> and keeps its edges, so it arrives in the
/// manifest as a count rather than as silence.
/// </remarks>
public static class DialogueRoles
{
    /// <summary>The speaker says something. Carries statements.</summary>
    public const string Speech = "speech";

    /// <summary>The player chooses. Carries the text of each option and its gate.</summary>
    public const string Choice = "choice";

    /// <summary>The conversation forks on authored state. Its outgoing edges carry the labels.</summary>
    public const string Branch = "branch";

    /// <summary>Authored state is read. Carries a declaration, never a result.</summary>
    public const string Condition = "condition";

    /// <summary>Something happens to the world. Carries outcomes.</summary>
    public const string Effect = "effect";

    /// <summary>The conversation returns to a point that is already on the page.</summary>
    public const string Jump = "jump";

    /// <summary>The conversation ends here.</summary>
    public const string End = "end";

    /// <summary>A type this walk does not read.</summary>
    public const string Unmodelled = "unmodelled";
}

/// <summary>One screen of authored speech.</summary>
public sealed class DialogueStatementSnapshot
{
    [JsonProperty("screenOrdinal")] public int ScreenOrdinal { get; set; }

    [JsonProperty("text")] public string Text { get; set; } = "";
}

/// <summary>One authored option a player can pick at a choice node.</summary>
public sealed class DialogueOptionSnapshot
{
    /// <summary>The output port this option leaves from, which is how an edge finds its option.</summary>
    [JsonProperty("port")] public string Port { get; set; } = "";

    [JsonProperty("text")] public string Text { get; set; } = "";

    /// <summary>The gate on this option, or null when the option is always offered.</summary>
    [JsonProperty("gate")] public DialogueConditionSnapshot? Gate { get; set; }
}

/// <summary>
/// A participant a node names.
/// </summary>
/// <remarks>
/// The game selects a participant in two ways. It names a record, which resolves to a published
/// character, or it selects one by role at runtime: the player, the speaker of this conversation, or
/// the quest object that started it. A role is not a missing reference, so it publishes as a role.
/// </remarks>
public sealed class DialogueParticipantSnapshot
{
    /// <summary>`player`, `speaker`, `quest-object`, or `named` when the game names a record.</summary>
    [JsonProperty("role")] public string Role { get; set; } = "";

    [JsonProperty("ref")] public SnapshotRef? Ref { get; set; }
}

/// <summary>A declaration of authored state a conversation reads.</summary>
public sealed class DialogueConditionSnapshot
{
    /// <summary>What is read: `faction`, `race`, `relationship`, `statCheck`, `quest`, `item`, and so on.</summary>
    [JsonProperty("kind")] public string Kind { get; set; } = "";

    /// <summary>The game's own comparison word, when the node carries one.</summary>
    [JsonProperty("compare")] public string? Compare { get; set; }

    /// <summary>The compared value as the game authors it, such as a relationship tier.</summary>
    [JsonProperty("value")] public string? Value { get; set; }

    /// <summary>What the check reads, as the game names it, such as a quest objective.</summary>
    [JsonProperty("label")] public string? Label { get; set; }

    /// <summary>True when the node inverts its own result.</summary>
    [JsonProperty("invert")] public bool Invert { get; set; }

    /// <summary>The published entities this condition reads, when it names any.</summary>
    [JsonProperty("subjects")] public List<SnapshotRef> Subjects { get; set; } = new();

    /// <summary>Whose state the condition reads.</summary>
    [JsonProperty("participants")] public List<DialogueParticipantSnapshot> Participants { get; set; } = new();

    /// <summary>The authored node or task type, so an unread kind still names itself.</summary>
    [JsonProperty("authoredType")] public string AuthoredType { get; set; } = "";

    /// <summary>
    /// The conditions a composite holds. A `ConditionList` gate is the only thing that tells two
    /// otherwise identical topics apart, so the children carry the gate's meaning, not the parent.
    /// </summary>
    [JsonProperty("children")] public List<DialogueConditionSnapshot> Children { get; set; } = new();

    /// <summary>`all` or `any` for a composite, and null for a leaf.</summary>
    [JsonProperty("childMode")] public string? ChildMode { get; set; }
}

/// <summary>One output of a branch, and the check the game reads before it takes that output.</summary>
public sealed class DialogueBranchSnapshot
{
    /// <summary>The output port the edge leaves from, which is the branch's index or `ELSE`.</summary>
    [JsonProperty("port")] public string Port { get; set; } = "";

    [JsonProperty("gate")] public DialogueConditionSnapshot? Gate { get; set; }
}

/// <summary>Something a conversation does to the world.</summary>
public sealed class DialogueEffectSnapshot
{
    /// <summary>`experience`, `money`, `item`, `quest-state`, `teleport`, and the rest.</summary>
    [JsonProperty("kind")] public string Kind { get; set; } = "";

    [JsonProperty("amount")] public int? Amount { get; set; }

    /// <summary>A named amount the game uses instead of a number, such as a relationship tier.</summary>
    [JsonProperty("amountLabel")] public string? AmountLabel { get; set; }

    /// <summary>What the outcome acts on, when it names a published entity.</summary>
    [JsonProperty("target")] public SnapshotRef? Target { get; set; }

    /// <summary>Who the outcome applies to.</summary>
    [JsonProperty("participant")] public DialogueParticipantSnapshot? Participant { get; set; }

    [JsonProperty("authoredType")] public string AuthoredType { get; set; } = "";
}

/// <summary>One node of a dialogue graph, in the shape a reader needs.</summary>
public sealed class DialogueNodeSnapshot
{
    /// <summary>The graph's own node id.</summary>
    [JsonProperty("id")] public int Id { get; set; }

    [JsonProperty("role")] public string Role { get; set; } = "";

    [JsonProperty("authoredType")] public string AuthoredType { get; set; } = "";

    /// <summary>Which opener the game prefers. Greetings are alternatives ordered by this.</summary>
    [JsonProperty("importance")] public int? Importance { get; set; }

    /// <summary>Speech screens, in authored order.</summary>
    [JsonProperty("statements")] public List<DialogueStatementSnapshot> Statements { get; set; } = new();

    /// <summary>True when the game joins the statements onto one screen.</summary>
    [JsonProperty("singleScreen")] public bool SingleScreen { get; set; }

    /// <summary>The options of a choice node.</summary>
    [JsonProperty("options")] public List<DialogueOptionSnapshot> Options { get; set; } = new();

    /// <summary>The gate on this node, for an opener or a condition node.</summary>
    [JsonProperty("gate")] public DialogueConditionSnapshot? Gate { get; set; }

    /// <summary>
    /// The check behind each output of a branch.
    /// </summary>
    /// <remarks>
    /// A `MultiBranchNode` holds one condition task per output and falls through to an else output.
    /// Without them a fork reads as "if 0" and "if else", which names nothing: one quest graph
    /// forks 17 identical questions this way, once per witness.
    /// </remarks>
    [JsonProperty("branches")] public List<DialogueBranchSnapshot> Branches { get; set; } = new();

    /// <summary>The outcomes of an effect node.</summary>
    [JsonProperty("effects")] public List<DialogueEffectSnapshot> Effects { get; set; } = new();

    /// <summary>The character the game shows as speaking, when the node names one.</summary>
    [JsonProperty("speaker")] public DialogueParticipantSnapshot? Speaker { get; set; }

    /// <summary>The node a jump returns to, when the walk can name it.</summary>
    [JsonProperty("jumpTarget")] public int? JumpTarget { get; set; }
}

/// <summary>One authored edge between two published nodes.</summary>
public sealed class DialogueEdgeSnapshot
{
    [JsonProperty("from")] public int From { get; set; }

    [JsonProperty("to")] public int To { get; set; }

    /// <summary>The order this edge leaves its source in.</summary>
    [JsonProperty("ordinal")] public int Ordinal { get; set; }

    /// <summary>The output the edge leaves from: an option port, or a branch label.</summary>
    [JsonProperty("port")] public string? Port { get; set; }
}

/// <summary>One dialogue graph as published data.</summary>
public sealed class DialogueGraphSnapshot
{
    [JsonProperty("graphName")] public string GraphName { get; set; } = "";

    [JsonProperty("nodes")] public List<DialogueNodeSnapshot> Nodes { get; set; } = new();

    [JsonProperty("edges")] public List<DialogueEdgeSnapshot> Edges { get; set; } = new();

    /// <summary>Nodes no published edge reaches. A conversation starts at one of these.</summary>
    [JsonProperty("entryNodes")] public List<int> EntryNodes { get; set; } = new();

    /// <summary>How many nodes of each authored type this walk did not read.</summary>
    [JsonProperty("unmodelledTypes")] public Dictionary<string, int> UnmodelledTypes { get; set; } = new();

    [JsonProperty("diagnostics")] public List<Diagnostic> Diagnostics { get; set; } = new();
}
