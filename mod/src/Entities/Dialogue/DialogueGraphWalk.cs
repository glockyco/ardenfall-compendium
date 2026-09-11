using System.Collections.Generic;
using System.Reflection;
using Ardenfall.Dialog;
using Ardenfall.Dialog.Nodes;

namespace ArdenfallCompendium.Entities.Dialogue;

/// <summary>One authored dialogue line, as the graph holds it.</summary>
public sealed record DialogueLine(int LineOrdinal, string Kind, string Text, int Importance);

/// <summary>
/// Reads the authored lines out of one dialogue graph.
/// </summary>
/// <remarks>
/// Every holder of authored dialogue reads through this walk, so a reader sees the same lines
/// whichever object owns them: a quest's character object, or a scene's dialogue interactable.
///
/// Greetings expose pure public accessors. Topics do not: <c>ITopicNode.GetTopicStatements</c>
/// consults live graph state through <c>IsNodeChoiceEntered</c> and <c>ApplyModifiers</c>, which no
/// asset-time walk can satisfy, so the authored <c>statement</c> field is read directly. That field
/// is also the text a reader wants: unsubstituted source prose, before the runtime rewrites it with
/// a debug prefix or a failed-check alternative.
///
/// The walk preserves the authored order and does not evaluate a condition or choose a branch.
/// </remarks>
public static class DialogueGraphWalk
{
    /// <param name="walked">
    /// True when a graph was present and its nodes were enumerated, whatever the walk yielded.
    /// Distinguishes "this object has no dialogue" from "a graph produced no lines".
    /// </param>
    public static IReadOnlyList<DialogueLine> Walk(DialogFlowGraph? graph, out bool walked)
    {
        walked = false;
        var lines = new List<DialogueLine>();
        var nodes = graph?.allNodes;
        if (nodes == null) return lines;

        walked = true;
        var ordinal = 0;
        foreach (var node in nodes)
        {
            var current = ordinal++;
            switch (node)
            {
                case GreetingFlowNode greeting:
                    Add(lines, current, "greeting", greeting.EditorGetStatement()?.text, greeting.GetImportance());
                    break;
                case TopicFlowNode topic:
                    Add(lines, current, "topic", AuthoredStatementText(topic), ((ITopicNode)topic).Importance);
                    break;
            }
        }

        return lines;
    }

    private static void Add(List<DialogueLine> lines, int lineOrdinal, string kind, string? text, int importance)
    {
        if (string.IsNullOrEmpty(text)) return;
        lines.Add(new DialogueLine(lineOrdinal, kind, text!, importance));
    }

    private static readonly FieldInfo? TopicStatementField = typeof(TopicFlowNode)
        .GetField("statement", BindingFlags.Instance | BindingFlags.NonPublic);

    private static string? AuthoredStatementText(TopicFlowNode topic) =>
        TopicStatementField?.GetValue(topic) is Statement statement ? statement.text : null;
}
