using System;
using System.Collections.Generic;
using System.Linq;
using Ardenfall;
using Ardenfall.Dialog;
using Ardenfall.Dialog.Nodes;
using NodeCanvas.Framework;
using UnityObject = UnityEngine.Object;

namespace ArdenfallCompendium.Entities.Dialogue;

/// <summary>
/// Maps an authored node type to the role a reader needs, and reads that role's payload.
/// </summary>
/// <remarks>
/// The table is keyed by the authored type name rather than by <c>typeof</c>. The dialogue graphs of
/// this build carry 147 node types, most of them with private serialized fields, and several of them
/// are generic FlowCanvas wrappers whose names carry backticks. A name-keyed table reads the same way
/// for all of them and is testable without a Unity object.
///
/// A type the table does not name publishes as <see cref="DialogueRoles.Unmodelled"/> with its
/// authored name, and the export counts it. A misspelled name therefore surfaces as an unmodelled
/// count in the manifest rather than as a missing node.
/// </remarks>
public static class DialogueNodeReaders
{
    /// <summary>
    /// Types that carry no text, no gate and no outcome. The walk joins their inbound edges to their
    /// outbound edges, so a published edge always joins two nodes a reader cares about.
    /// </summary>
    private static readonly HashSet<string> ControlTypes = new(StringComparer.Ordinal)
    {
        // Routing and wires.
        "GoToStatement", "GoToLabel", "Reroute`1", "Return", "Finish", "Dummy", "ForLoop",
        "ForEach`1", "MacroNodeWrapper", "SimplexNodeWrapper`1", "ReflectedMethodNodeWrapper",
        "ReflectedFieldNodeWrapper", "SetRerouteValue`1", "GetRerouteValueNode",
        // Blackboard plumbing.
        "SetVariable`1", "GetVariable`1", "GenerateSeedNode",
        // Value readers whose result a condition or an effect already reports.
        "GetCharacterNode", "GetCharacterObject", "GetDateTime", "GetBountyTowardsNode",
        // Graph entry events. The node the event starts becomes the entry node.
        "CustomFunctionEvent", "CustomFunctionCall", "OnDialogAddToNPC", "OnQuestEventNode",
        "OnQuestStateChange", "OnReadNoteNode", "OnEnterQuestLocation",
        "OnCountedCharacterGroupDeath",
        // Presentation and timing the compendium does not publish.
        "WaitTimeNode", "WaitUnscaledTime", "WaitUntilDateTimeNode", "PlayAnimationNode",
        "OverrideDialogFocusNode", "OverrideDialogFocusLocationNode", "ClearSpeechNode",
        "SetDialogArgumentNode", "DevNoteNode", "ToDoNode", "FilterBarkAssetNode",
        // Named from a live export's unmodelled counts: wires, value readers and presentation.
        "RerouteFlow", "GetRerouteValueNode`1", "ReflectedExtractorNodeWrapper`1", "SetFieldsNode`1",
        "GetValueFunction`1", "ValueFunctionDefinition`1", "GetQuestVariable",
        "GetQuestLocationNode", "GetCharacterGroupCharacters", "GetStaticReferenceQuestObjectNode",
        "SetCharacterDialogExpression", "SetCharacterDialogLookAt", "ClearDialogFocusNode",
        "HideDialogNode", "PlaySoundNode", "FadeScreenInAndOutNode", "LockInputNode",
        "AutoSaveNode", "ConsequenceNode",
    };

    private static readonly Dictionary<string, string> RoleByType = new(StringComparer.Ordinal)
    {
        ["SpeakFlowNode"] = DialogueRoles.Speech,
        ["GreetingFlowNode"] = DialogueRoles.Speech,
        ["ShowMessageNode"] = DialogueRoles.Speech,
        ["ShowGenericMessageNode"] = DialogueRoles.Speech,
        ["TopicFlowNode"] = DialogueRoles.Choice,
        ["GoodbyeFlowNode"] = DialogueRoles.Choice,
        ["MultiTopicFlowNode"] = DialogueRoles.Choice,
        ["MultipleChoiceFlowNode"] = DialogueRoles.Choice,
        ["GoToLastMultipleChoice"] = DialogueRoles.Jump,
        ["FinishDialogFlowNode"] = DialogueRoles.End,
        ["BranchRelationshipNode"] = DialogueRoles.Branch,
        ["CharacterGroupDialogBranchNode"] = DialogueRoles.Branch,
        ["MultiBranchNode"] = DialogueRoles.Branch,
        ["SwitchBool"] = DialogueRoles.Branch,
        ["SwitchConditionTask"] = DialogueRoles.Branch,
        ["SwitchSeededRandom"] = DialogueRoles.Branch,
        ["Random"] = DialogueRoles.Branch,
        ["SingleBranchQuestStateNode"] = DialogueRoles.Branch,
        ["SingleBranchQuestPhaseNode"] = DialogueRoles.Branch,
        ["MultiANDNode"] = DialogueRoles.Condition,
        ["TaskCondition"] = DialogueRoles.Condition,
        ["FactionCheck"] = DialogueRoles.Condition,
        ["RaceCheck"] = DialogueRoles.Condition,
        ["RelationshipCheck"] = DialogueRoles.Condition,
        ["CheckQuestVariable"] = DialogueRoles.Condition,
        ["CheckQuestStateNode"] = DialogueRoles.Condition,
        ["CheckQuestPhaseNode"] = DialogueRoles.Condition,
        ["CheckQuestObjectiveStateNode"] = DialogueRoles.Condition,
        ["CheckPackageDialogFlagNode"] = DialogueRoles.Condition,
        ["CheckIsDetected"] = DialogueRoles.Condition,
        ["QuestLocationCheck"] = DialogueRoles.Condition,
        ["DiscoveredLocationCheck"] = DialogueRoles.Condition,
        ["ContainsItemNode"] = DialogueRoles.Condition,
        ["HasInteractedWithNode"] = DialogueRoles.Condition,
        ["IsDeadNode"] = DialogueRoles.Condition,
        ["IsNullNode"] = DialogueRoles.Condition,
        ["PresetHasGoldNode"] = DialogueRoles.Condition,
        ["SingleUseNode"] = DialogueRoles.Condition,
        ["TimeCheck"] = DialogueRoles.Condition,
        ["CheckTimePeriod"] = DialogueRoles.Condition,
        ["WeatherCheck"] = DialogueRoles.Condition,
        ["FactionRelationshipCheck"] = DialogueRoles.Condition,
        ["MoneyCheckNode"] = DialogueRoles.Condition,
        ["TraitCheck"] = DialogueRoles.Condition,
        ["StatCheck"] = DialogueRoles.Condition,
        ["ReadNoteCheck"] = DialogueRoles.Condition,
        ["CheckStatusEffectSimpleNode"] = DialogueRoles.Condition,
        ["InHomeCheck"] = DialogueRoles.Condition,
        ["WithinDistanceOfQuestObject"] = DialogueRoles.Condition,
        ["MultiORNode"] = DialogueRoles.Condition,
        ["RefuseToSpeakFlowNode"] = DialogueRoles.Condition,
        ["CharacterGroupDialogSwitchNode"] = DialogueRoles.Branch,
        ["XPNode"] = DialogueRoles.Effect,
        ["ModifyMoneyNode"] = DialogueRoles.Effect,
        ["AddItemListNode"] = DialogueRoles.Effect,
        ["SetQuestVariable"] = DialogueRoles.Effect,
        ["SetQuestStateNode"] = DialogueRoles.Effect,
        ["SetQuestPhaseNode"] = DialogueRoles.Effect,
        ["SetQuestObjectiveStateNode"] = DialogueRoles.Effect,
        ["SetRewardSetEnabledNode"] = DialogueRoles.Effect,
        ["TriggerQuestEventNode"] = DialogueRoles.Effect,
        ["TriggerSteamAchievementNode"] = DialogueRoles.Effect,
        ["ModifyRelationshipWith"] = DialogueRoles.Effect,
        ["ModifyFactionRelationshipWith"] = DialogueRoles.Effect,
        ["ModifyInterfactionFactionRelationship"] = DialogueRoles.Effect,
        ["TeleportCharacterToLocationNode"] = DialogueRoles.Effect,
        ["TeleportCharacterNode"] = DialogueRoles.Effect,
        ["TeleportToPreviousPointCharacterNode"] = DialogueRoles.Effect,
        ["CloseAndStartCombat"] = DialogueRoles.Effect,
        ["DeleteCharacterNode"] = DialogueRoles.Effect,
        ["DespawnNPCNode"] = DialogueRoles.Effect,
        ["SendToPrisonNode"] = DialogueRoles.Effect,
        ["AddLocationMapMarker"] = DialogueRoles.Effect,
        ["AddQuestMarker"] = DialogueRoles.Effect,
        ["RemoveQuestMarker"] = DialogueRoles.Effect,
        ["AddPackageNode"] = DialogueRoles.Effect,
        ["RemovePackageNode"] = DialogueRoles.Effect,
        ["AddDialogMemberNode"] = DialogueRoles.Effect,
        ["MerchantDialogFlowNode"] = DialogueRoles.Effect,
        ["NPCRepairMenuNode"] = DialogueRoles.Effect,
        ["OpenTrainUINode"] = DialogueRoles.Effect,
        ["AddJournalEntry"] = DialogueRoles.Effect,
        ["AddJournalEntryNode"] = DialogueRoles.Effect,
        ["AddStatusEffectNode"] = DialogueRoles.Effect,
        ["GiveRewardSetNode"] = DialogueRoles.Effect,
        ["SetObjectiveHidden"] = DialogueRoles.Effect,
        ["TradeDiscountNode"] = DialogueRoles.Effect,
        ["OpenFastTravelNode"] = DialogueRoles.Effect,
        ["FastTravelNode"] = DialogueRoles.Effect,
        ["KillCharacterNode"] = DialogueRoles.Effect,
    };

    /// <summary>The outcome each effect type states, in the words a reader needs.</summary>
    private static readonly Dictionary<string, string> EffectKindByType = new(StringComparer.Ordinal)
    {
        ["XPNode"] = "experience",
        ["ModifyMoneyNode"] = "money",
        ["AddItemListNode"] = "item",
        ["SetQuestVariable"] = "quest-variable",
        ["SetQuestStateNode"] = "quest-state",
        ["SetQuestPhaseNode"] = "quest-phase",
        ["SetQuestObjectiveStateNode"] = "quest-objective",
        ["SetRewardSetEnabledNode"] = "quest-reward-set",
        ["TriggerQuestEventNode"] = "quest-event",
        ["TriggerSteamAchievementNode"] = "achievement",
        ["ModifyRelationshipWith"] = "character-relationship",
        ["ModifyFactionRelationshipWith"] = "faction-relationship",
        ["ModifyInterfactionFactionRelationship"] = "faction-relationship",
        ["TeleportCharacterToLocationNode"] = "teleport",
        ["TeleportCharacterNode"] = "teleport",
        ["TeleportToPreviousPointCharacterNode"] = "teleport",
        ["CloseAndStartCombat"] = "combat-start",
        ["DeleteCharacterNode"] = "character-death",
        ["DespawnNPCNode"] = "character-despawn",
        ["SendToPrisonNode"] = "imprisonment",
        ["AddLocationMapMarker"] = "map-marker",
        ["AddQuestMarker"] = "map-marker",
        ["RemoveQuestMarker"] = "map-marker",
        ["AddPackageNode"] = "package",
        ["RemovePackageNode"] = "package",
        ["AddDialogMemberNode"] = "dialogue-member",
        ["MerchantDialogFlowNode"] = "merchant",
        ["NPCRepairMenuNode"] = "repair",
        ["OpenTrainUINode"] = "training",
        ["AddJournalEntry"] = "journal",
        ["AddJournalEntryNode"] = "journal",
        ["AddStatusEffectNode"] = "status-effect",
        ["GiveRewardSetNode"] = "quest-reward-set",
        ["SetObjectiveHidden"] = "quest-objective",
        ["TradeDiscountNode"] = "trade-discount",
        ["OpenFastTravelNode"] = "fast-travel",
        ["FastTravelNode"] = "fast-travel",
        ["KillCharacterNode"] = "character-death",
    };

    /// <summary>
    /// What a check reads, in the words a reader needs.
    /// </summary>
    /// <remarks>
    /// Keyed by <see cref="CheckKey"/>, so one entry serves both the node spelling and the task
    /// spelling of the same check.
    /// </remarks>
    private static readonly Dictionary<string, string> ConditionKindByType = new(StringComparer.Ordinal)
    {
        ["FactionCheck"] = "faction",
        ["RaceCheck"] = "race",
        ["RelationshipCheck"] = "character-relationship",
        ["CheckQuestVariable"] = "quest-variable",
        ["CheckQuestState"] = "quest-state",
        ["CheckQuestPhase"] = "quest-phase",
        ["CheckQuestObjective"] = "quest-objective",
        ["CheckQuestObjectiveState"] = "quest-objective",
        ["CheckPackageDialogFlag"] = "package-flag",
        ["CheckIsDetected"] = "detection",
        ["QuestLocationCheck"] = "quest-location",
        ["DiscoveredLocationCheck"] = "location-discovered",
        ["ContainsItem"] = "item-held",
        ["HasInteractedWith"] = "already-spoken",
        ["IsDead"] = "death",
        ["SingleUse"] = "once",
        ["TimeCheck"] = "time",
        ["CheckTimePeriod"] = "time",
        ["WeatherCheck"] = "weather",
        ["FactionRelationshipCheck"] = "faction-relationship",
        ["MoneyCheck"] = "money-held",
        ["TraitCheck"] = "trait",
        ["StatCheck"] = "stat-check",
        ["ReadNoteCheck"] = "note-read",
        ["CheckStatusEffectSimple"] = "status-effect",
        ["InHome"] = "at-home",
        ["WithinDistanceOfQuestObject"] = "near-quest-object",
        ["RefuseToSpeakFlow"] = "refuses-to-speak",
        // Composites and blackboard checks, which a task list holds.
        ["ConditionList"] = "all-of",
        ["CheckBoolean"] = "graph-variable",
        ["SwitchBool"] = "graph-variable",
        ["Random"] = "chance",
        ["MultiAND"] = "all-of",
        ["MultiOR"] = "any-of",
        ["MultiBranch"] = "branch-on-checks",
        ["SingleBranchQuestState"] = "quest-state",
        ["SingleBranchQuestPhase"] = "quest-phase",
        ["CharacterGroupDialogSwitch"] = "character-group",
        ["PresetHasGold"] = "money-held",
    };

    public static bool IsControl(string authoredType) => ControlTypes.Contains(authoredType);

    public static string RoleOf(string authoredType) =>
        RoleByType.TryGetValue(authoredType, out var role) ? role : DialogueRoles.Unmodelled;

    /// <summary>Reads the payload of one node, whatever its role.</summary>
    public static DialogueNodeSnapshot Read(Node node)
    {
        var authoredType = node.GetType().Name;
        var snapshot = new DialogueNodeSnapshot
        {
            Id = node.ID,
            AuthoredType = authoredType,
            Role = RoleOf(authoredType),
        };

        switch (snapshot.Role)
        {
            case DialogueRoles.Speech:
                ReadSpeech(node, snapshot);
                break;
            case DialogueRoles.Choice:
                ReadChoice(node, authoredType, snapshot);
                break;
            case DialogueRoles.Condition:
                snapshot.Gate = ReadCondition(node, authoredType);
                break;
            case DialogueRoles.Branch:
                snapshot.Gate = ReadCondition(node, authoredType);
                ReadBranches(node, snapshot);
                break;
            case DialogueRoles.Effect:
                snapshot.Effects.Add(ReadEffect(node, authoredType));
                break;
        }

        return snapshot;
    }

    private static void ReadSpeech(Node node, DialogueNodeSnapshot snapshot)
    {
        AddStatement(snapshot, GraphFields.Read<Statement>(node, "statement"));
        var others = GraphFields.Read<List<Statement>>(node, "otherStatements");
        if (others != null)
        {
            foreach (var statement in others) AddStatement(snapshot, statement);
        }

        snapshot.SingleScreen = GraphFields.ReadBool(node, "singleScreen");
        if (GraphFields.TryRead<int>(node, "importance", out var importance))
        {
            snapshot.Importance = importance;
        }

        // A greeting is an opener the game chooses between, so its own gate belongs to it.
        snapshot.Gate = ReadTaskCondition(node);
    }

    private static void ReadChoice(Node node, string authoredType, DialogueNodeSnapshot snapshot)
    {
        if (GraphFields.TryRead<int>(node, "importance", out var importance))
        {
            snapshot.Importance = importance;
        }

        var choices = GraphFields.Read<List<Choice>>(node, "availableChoices")
            ?? GraphFields.Read<List<Choice>>(node, "choices");
        if (choices != null)
        {
            // The game names each option's output port after the option's id, or after its index when
            // it has none, which is how an edge finds the option it leaves from.
            for (var index = 0; index < choices.Count; index++)
            {
                var choice = choices[index];
                if (choice == null) continue;
                var port = (choice.id != -1 ? choice.id : index).ToString();
                snapshot.Options.Add(new DialogueOptionSnapshot
                {
                    Port = port,
                    Text = choice.statement?.text ?? "",
                    Gate = choice.enableCheck ? ReadChoiceCheck(choice.choiceCheck, authoredType) : null,
                });
            }

            if (GraphFields.ReadBool(node, "enableNpcSpeak"))
            {
                AddStatement(snapshot, GraphFields.Read<Statement>(node, "npcSpeakStatement"));
            }

            return;
        }

        // A topic is one option on its own node, and its output is the node's single flow output.
        var text = GraphFields.Read<Statement>(node, "statement")?.text ?? "";
        var enableCheck = GraphFields.ReadBool(node, "enableCheck");
        var check = GraphFields.Read<ChoiceCheck>(node, "check");
        snapshot.Options.Add(new DialogueOptionSnapshot
        {
            Port = "",
            Text = text,
            Gate = enableCheck ? ReadChoiceCheck(check, authoredType) : null,
        });
        snapshot.Gate = ReadTaskCondition(node);
    }

    private static void AddStatement(DialogueNodeSnapshot snapshot, Statement? statement)
    {
        var text = statement?.text;
        if (string.IsNullOrEmpty(text)) return;
        snapshot.Statements.Add(new DialogueStatementSnapshot
        {
            ScreenOrdinal = snapshot.Statements.Count,
            Text = text!,
        });
    }

    /// <summary>The gate a stat, race, faction or relationship check on an option declares.</summary>
    private static DialogueConditionSnapshot? ReadChoiceCheck(ChoiceCheck? check, string authoredType)
    {
        if (check == null) return null;
        var condition = new DialogueConditionSnapshot
        {
            AuthoredType = authoredType,
            Kind = check.category switch
            {
                ChoiceCheck.ChoiceCheckCategory.StatCheck => "stat-check",
                ChoiceCheck.ChoiceCheckCategory.RaceCheck => "race",
                ChoiceCheck.ChoiceCheckCategory.TraitCheck => "trait",
                ChoiceCheck.ChoiceCheckCategory.FactionCheck => "faction",
                ChoiceCheck.ChoiceCheckCategory.RelationshipCheck => "character-relationship",
                ChoiceCheck.ChoiceCheckCategory.FactionRelationshipCheck => "faction-relationship",
                _ => "unread",
            },
            Compare = check.comparisonOperator.ToString(),
        };

        switch (check.category)
        {
            case ChoiceCheck.ChoiceCheckCategory.StatCheck:
                condition.Value = check.statCheckDifficulty.ToString();
                AddSubject(condition, check.statCheck, "ChoiceCheck.statCheck");
                break;
            case ChoiceCheck.ChoiceCheckCategory.RaceCheck:
                condition.Value = check.raceCheck != null ? check.raceCheck.name : null;
                AddSubject(condition, check.raceCheck, "ChoiceCheck.raceCheck");
                break;
            case ChoiceCheck.ChoiceCheckCategory.RelationshipCheck:
            case ChoiceCheck.ChoiceCheckCategory.FactionRelationshipCheck:
                condition.Value = check.relationshipCheck.ToString();
                break;
            default:
                condition.Value = check.customValue.ToString();
                break;
        }

        return condition;
    }

    /// <summary>The gate a node inherits from `DialogConditionTaskFlowNode`.</summary>
    private const int MaxConditionDepth = 4;

    private static DialogueConditionSnapshot? ReadTaskCondition(Node node)
    {
        var task = GraphFields.Read<ConditionTask>(node, "condition");
        return task == null ? null : ReadTask(task, 0);
    }

    /// <summary>
    /// One condition task, and the tasks it holds.
    /// </summary>
    /// <remarks>
    /// A `ConditionList` is the most common gate in this build, and it carries no meaning of its own:
    /// the checks it holds are the only thing that tells two otherwise identical topics apart. One
    /// quest graph asks "Did you see anything out of the ordinary?" 17 times, once per witness, and
    /// each copy is separated by its list. Reading the parent alone published 17 identical questions.
    ///
    /// The depth limit is a guard against an authored cycle, which the game itself would not survive,
    /// rather than a shape this build holds: its deepest list nests once.
    /// </remarks>
    private static DialogueConditionSnapshot ReadTask(ConditionTask task, int depth)
    {
        var authoredType = task.GetType().Name;
        var condition = new DialogueConditionSnapshot
        {
            AuthoredType = authoredType,
            Kind = KindOf(authoredType),
            Invert = task.invert,
            Compare = GraphFields.ReadEnumName(task, "compareMethod")
                ?? GraphFields.ReadEnumName(task, "comparisonOperator"),
        };

        ReadCheckPayload(task, authoredType, condition);

        var children = GraphFields.Read<List<ConditionTask>>(task, "conditions");
        if (children != null && depth < MaxConditionDepth)
        {
            condition.ChildMode =
                GraphFields.ReadEnumName(task, "checkMode") == "AnyTrueSuffice" ? "any" : "all";
            foreach (var child in children)
            {
                if (child == null) continue;
                condition.Children.Add(ReadTask(child, depth + 1));
            }
        }

        return condition;
    }

    /// <summary>The check the game reads before it takes each output of a branch.</summary>
    private static void ReadBranches(Node node, DialogueNodeSnapshot snapshot)
    {
        ReadCharacterGroupBranches(node, snapshot);

        var tasks = GraphFields.Read<List<ConditionTask>>(node, "conditionTasks");
        if (tasks == null) return;
        for (var index = 0; index < tasks.Count; index++)
        {
            var task = tasks[index];
            snapshot.Branches.Add(new DialogueBranchSnapshot
            {
                Port = index.ToString(),
                Gate = task == null ? null : ReadTask(task, 0),
            });
        }
    }

    /// <summary>
    /// Who each output of a character-group branch speaks to.
    /// </summary>
    /// <remarks>
    /// `CharacterGroupDialogBranchNode` adds one output per character record of the quest's group
    /// and names it `value_i`, so the index is the only thing an edge carries. The records are the
    /// witnesses of the quest, and without them one conversation printed 26 copies of the same
    /// question and a fork whose branches read `value_0` through `value_16`.
    /// </remarks>
    private static void ReadCharacterGroupBranches(Node node, DialogueNodeSnapshot snapshot)
    {
        var group = DialogueRefs.CharacterGroup(
            GraphFields.Read<object>(node, "characterGroup"),
            node.graph as DialogFlowGraph);
        if (group == null) return;

        var records = GraphFields.Read<System.Collections.IList>(group, "characterRecords");
        if (records == null) return;

        for (var index = 0; index < records.Count; index++)
        {
            var container = records[index];
            var record = container == null
                ? null
                : GraphFields.Read<Ardenfall.RecordSystem.RecordReference>(container, "record");
            snapshot.Branches.Add(new DialogueBranchSnapshot
            {
                Port = $"value_{index}",
                Gate = new DialogueConditionSnapshot
                {
                    Kind = "speaking-to",
                    AuthoredType = node.GetType().Name,
                    Participants = { DialogueRefs.RecordParticipant(record) },
                },
            });
        }
    }

    private static DialogueConditionSnapshot ReadCondition(Node node, string authoredType)
    {
        var condition = new DialogueConditionSnapshot
        {
            AuthoredType = authoredType,
            Kind = KindOf(authoredType),
            Invert = GraphFields.ReadBool(node, "invert"),
            Compare = GraphFields.ReadEnumName(node, "compareMethod")
                ?? GraphFields.ReadEnumName(node, "comparisonOperator"),
        };

        // A node that wraps a task carries no check of its own; the task it holds is the check.
        var task = GraphFields.Read<ConditionTask>(node, "condition");
        if (task != null)
        {
            var inner = ReadTask(task, 0);
            inner.Invert ^= condition.Invert;
            return inner;
        }

        ReadCheckPayload(node, authoredType, condition);
        return condition;
    }

    /// <summary>
    /// What one check reads, whether a node or a task declares it.
    /// </summary>
    /// <remarks>
    /// The game authors each check twice: `RaceCheck` as a node and `RaceCheckCondition` as a task,
    /// with the same field names. Normalising the two names onto one key reads both with one table,
    /// so a check published from a node and the same check published from a list read alike.
    /// </remarks>
    private static void ReadCheckPayload(object source, string authoredType, DialogueConditionSnapshot condition)
    {
        switch (CheckKey(authoredType))
        {
            case "FactionCheck":
                AddSubjects(condition, GraphFields.Read<List<Ardenfall.Faction>>(source, "factionGroups"), $"{authoredType}.factionGroups");
                condition.Participants.Add(DialogueRefs.Participant(GraphFields.Read<object>(source, "character"), $"{authoredType}.character"));
                break;
            case "RaceCheck":
                AddSubjects(condition, GraphFields.Read<List<RaceGroup>>(source, "raceGroups"), $"{authoredType}.raceGroups");
                condition.Participants.Add(DialogueRefs.Participant(GraphFields.Read<object>(source, "character"), $"{authoredType}.character"));
                break;
            case "RelationshipCheck":
            case "BranchRelationship":
                condition.Participants.Add(DialogueRefs.Participant(GraphFields.Read<object>(source, "sourceCharacter"), $"{authoredType}.sourceCharacter"));
                condition.Participants.Add(DialogueRefs.Participant(GraphFields.Read<object>(source, "targetCharacter"), $"{authoredType}.targetCharacter"));
                condition.Value ??= RelationshipAmount(source);
                break;
            case "FactionRelationshipCheck":
                AddSubject(condition, GraphFields.Read<Ardenfall.Faction>(source, "faction"), $"{authoredType}.faction");
                condition.Participants.Add(DialogueRefs.Participant(GraphFields.Read<object>(source, "targetCharacter"), $"{authoredType}.targetCharacter"));
                condition.Value ??= RelationshipAmount(source);
                break;
            case "StatCheck":
                AddSubject(condition, GraphFields.Read<UnityObject>(source, "stat"), $"{authoredType}.stat");
                condition.Value ??= GraphFields.ReadEnumName(source, "statCheckDifficulty");
                break;
            case "CheckQuestObjective":
            case "CheckQuestObjectiveState":
                AddQuestSubject(condition, source, authoredType);
                condition.Value ??= GraphFields.ReadEnumName(source, "state");
                condition.Label ??= DialogueRefs.ObjectiveName(
                    GraphFields.Read<object>(source, "objectiveReference"),
                    OwningGraph(source));
                break;
            case "CheckQuestVariable":
            case "CheckQuestState":
            case "CheckQuestPhase":
            case "QuestLocationCheck":
                AddQuestSubject(condition, source, authoredType);
                condition.Value ??= GraphFields.ReadEnumName(source, "stage")
                    ?? GraphFields.ReadEnumName(source, "questState")
                    ?? GraphFields.ReadEnumName(source, "state");
                break;
            case "HasInteractedWith":
            case "IsDead":
                condition.Participants.Add(DialogueRefs.Participant(GraphFields.Read<object>(source, "characterReference"), $"{authoredType}.characterReference"));
                break;
            case "ContainsItem":
                AddSubject(condition, GraphFields.Read<UnityObject>(source, "singleItem"), $"{authoredType}.singleItem");
                condition.Participants.Add(DialogueRefs.Participant(GraphFields.Read<object>(source, "character"), $"{authoredType}.character"));
                break;
            case "CheckBoolean":
                // A blackboard check names the flag it reads; the flag's name is the only thing a
                // reader can hold onto, because its value lives in a running conversation.
                condition.Value ??= GraphFields.Read<object>(source, "valueA") is { } flag
                    ? GraphFields.Read<string>(flag, "_name")
                    : null;
                break;
            case "WeatherCheck":
                AddSubjects(condition, GraphFields.Read<List<Ardenfall.Sky.Weather>>(source, "weathers"), $"{authoredType}.weathers");
                break;
        }
    }

    /// <summary>The tier a relationship check compares against, as the game names it.</summary>
    private static string? RelationshipAmount(object source)
    {
        var container = GraphFields.Read<object>(source, "comparedRelationshipAmount");
        return container == null ? null : GraphFields.ReadEnumName(container, "amount");
    }

    /// <summary>
    /// The graph a check lives in, which resolves a reference to "this quest".
    /// </summary>
    /// <remarks>
    /// A node knows its graph; a task knows the system that owns it. Both are the flow graph the
    /// reference resolves against at runtime.
    /// </remarks>
    private static DialogFlowGraph? OwningGraph(object source) =>
        source switch
        {
            Node node => node.graph as DialogFlowGraph,
            Task task => task.ownerSystem as DialogFlowGraph,
            _ => null,
        };

    /// <summary>
    /// The key both spellings of a check share.
    /// </summary>
    /// <remarks>
    /// The game names a check `RaceCheck` when a node declares it and `RaceCheckCondition` when a
    /// task does, and adds `Node` to several node names. Trimming both suffixes gives one key.
    /// </remarks>
    public static string CheckKey(string authoredType)
    {
        var key = authoredType;
        if (key.EndsWith("Condition", StringComparison.Ordinal)) key = key.Substring(0, key.Length - "Condition".Length);
        if (key.EndsWith("Node", StringComparison.Ordinal)) key = key.Substring(0, key.Length - "Node".Length);
        return key;
    }

    private static string KindOf(string authoredType) =>
        ConditionKindByType.TryGetValue(CheckKey(authoredType), out var kind) ? kind : "unread";

    private static DialogueEffectSnapshot ReadEffect(Node node, string authoredType)
    {
        var effect = new DialogueEffectSnapshot
        {
            AuthoredType = authoredType,
            Kind = EffectKindByType.TryGetValue(authoredType, out var kind) ? kind : "unread",
        };

        switch (authoredType)
        {
            case "XPNode":
                effect.AmountLabel = GraphFields.ReadEnumName(node, "amount");
                effect.Amount = ReadBlackboardInt(node, "addAmount");
                break;
            case "ModifyMoneyNode":
                effect.Amount = ReadBlackboardInt(node, "addAmount");
                if (GraphFields.ReadBool(node, "invertCost") && effect.Amount.HasValue)
                {
                    effect.Amount = -effect.Amount.Value;
                }

                break;
            case "AddItemListNode":
                if (GraphFields.ReadBool(node, "isSingleItem"))
                {
                    effect.Amount = GraphFields.ReadInt(node, "singleItemCount");
                    effect.Target = DialogueRefs.Asset(GraphFields.Read<UnityObject>(node, "singleItem"), "AddItemListNode.singleItem");
                }
                else
                {
                    effect.Target = DialogueRefs.Asset(GraphFields.Read<UnityObject>(node, "itemList"), "AddItemListNode.itemList");
                }

                break;
            case "SetQuestStateNode":
                effect.AmountLabel = GraphFields.ReadEnumName(node, "state");
                effect.Target = DialogueRefs.Quest(GraphFields.Read<object>(node, "quest"), "SetQuestStateNode.quest");
                break;
            case "SetQuestObjectiveStateNode":
                effect.AmountLabel = GraphFields.ReadEnumName(node, "state");
                effect.Target = DialogueRefs.Quest(GraphFields.Read<object>(node, "objectiveReference"), "SetQuestObjectiveStateNode.objectiveReference");
                break;
            case "SetQuestPhaseNode":
                effect.Target = DialogueRefs.Quest(GraphFields.Read<object>(node, "phase"), "SetQuestPhaseNode.phase");
                break;
            case "SetQuestVariable":
                effect.Target = DialogueRefs.Quest(GraphFields.Read<object>(node, "customVariableQuest"), "SetQuestVariable.customVariableQuest");
                break;
            case "TriggerQuestEventNode":
                effect.Target = DialogueRefs.Quest(GraphFields.Read<object>(node, "questEvent"), "TriggerQuestEventNode.questEvent");
                break;
            case "ModifyRelationshipWith":
                effect.Participant = DialogueRefs.Participant(GraphFields.Read<object>(node, "targetCharacter"), "ModifyRelationshipWith.targetCharacter");
                break;
            case "ModifyFactionRelationshipWith":
                effect.Target = DialogueRefs.Asset(GraphFields.Read<UnityObject>(node, "faction"), "ModifyFactionRelationshipWith.faction");
                effect.Participant = DialogueRefs.Participant(GraphFields.Read<object>(node, "targetCharacter"), "ModifyFactionRelationshipWith.targetCharacter");
                break;
            case "TeleportCharacterToLocationNode":
                effect.Target = DialogueRefs.Quest(GraphFields.Read<object>(node, "location"), "TeleportCharacterToLocationNode.location");
                effect.Participant = DialogueRefs.Participant(GraphFields.Read<object>(node, "character"), "TeleportCharacterToLocationNode.character");
                break;
            case "AddStatusEffectNode":
                effect.Target = DialogueRefs.Asset(GraphFields.Read<UnityObject>(node, "statusEffect"), "AddStatusEffectNode.statusEffect");
                effect.Participant = DialogueRefs.Participant(GraphFields.Read<object>(node, "character"), "AddStatusEffectNode.character");
                break;
            case "AddJournalEntry":
            case "AddJournalEntryNode":
            case "SetObjectiveHidden":
            case "GiveRewardSetNode":
                effect.Target = DialogueRefs.Quest(GraphFields.Read<object>(node, "quest"), $"{authoredType}.quest");
                break;
            case "KillCharacterNode":
            case "DeleteCharacterNode":
            case "DespawnNPCNode":
                effect.Participant = DialogueRefs.Participant(GraphFields.Read<object>(node, "character"), $"{authoredType}.character");
                break;
        }

        return effect;
    }

    private static void AddQuestSubject(DialogueConditionSnapshot condition, object node, string authoredType)
    {
        var quest = DialogueRefs.Quest(GraphFields.Read<object>(node, "quest"), $"{authoredType}.quest")
            ?? DialogueRefs.Quest(GraphFields.Read<object>(node, "objectiveReference"), $"{authoredType}.objectiveReference")
            ?? DialogueRefs.Quest(GraphFields.Read<object>(node, "customVariableQuest"), $"{authoredType}.customVariableQuest")
            ?? DialogueRefs.Quest(GraphFields.Read<object>(node, "variableRef"), $"{authoredType}.variableRef");
        // A graph that refers to "this quest" names no asset. That is a self reference, not a
        // subject, and publishing it as one would print a gate about nothing.
        if (quest != null && quest.Kind != "missing") condition.Subjects.Add(quest);
    }

    private static void AddSubject(DialogueConditionSnapshot condition, UnityObject? asset, string source)
    {
        var reference = DialogueRefs.Asset(asset, source);
        if (reference != null && reference.Kind != "missing") condition.Subjects.Add(reference);
    }

    private static void AddSubjects<T>(
        DialogueConditionSnapshot condition,
        List<T>? assets,
        string source)
        where T : UnityObject
    {
        if (assets == null) return;
        foreach (var asset in assets.Where(asset => asset != null))
        {
            AddSubject(condition, asset, source);
        }
    }

    /// <summary>A `BBParameter&lt;int&gt;` holds its authored number in a public value property.</summary>
    private static int? ReadBlackboardInt(Node node, string field)
    {
        var parameter = GraphFields.Read<object>(node, field);
        return parameter == null ? null : GraphFields.ReadProperty<int>(parameter, "value");
    }
}
