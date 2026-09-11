using Ardenfall;
using Ardenfall.Dialog;
using FlowCanvas;
using Ardenfall.Questing;
using Ardenfall.RecordSystem;
using ArdenfallCompendium.Dtos;
using UnityObject = UnityEngine.Object;

namespace ArdenfallCompendium.Entities.Dialogue;

/// <summary>
/// Resolves what a dialogue node points at.
/// </summary>
/// <remarks>
/// A node points at three kinds of thing: an authored asset, such as an item or a faction; a record,
/// such as a placed character; or a participant the game selects at runtime, such as the player. The
/// first two resolve to a published entity. The third is a role, and inventing an entity for it would
/// state something the data does not.
/// </remarks>
internal static class DialogueRefs
{
    /// <summary>
    /// The entity types the compendium publishes under an asset name rather than a lookup guid.
    /// </summary>
    /// <remarks>
    /// A guid reference to one of these resolves to nothing, because its published id is
    /// `named;&lt;entity&gt;;&lt;asset name&gt;`. The same mapping drives `RefResolver`.
    /// </remarks>
    private static readonly System.Collections.Generic.Dictionary<System.Type, string> NamedEntities =
        new()
        {
            [typeof(Ardenfall.StatType)] = "stat-type",
            [typeof(Ardenfall.ItemCategory)] = "item-category",
            [typeof(Ardenfall.SpellData)] = "spell",
            [typeof(Ardenfall.CharacterRace)] = "character-race",
            [typeof(Ardenfall.CharacterData)] = "character",
            [typeof(Ardenfall.Questing.QuestData)] = "quest",
        };

    /// <summary>The asset a field holds, or null when the field holds nothing.</summary>
    public static SnapshotRef? Asset(UnityObject? asset, string source)
    {
        if (asset == null) return null;
        if (NamedEntities.TryGetValue(asset.GetType(), out var entity))
        {
            return SnapshotRef.NamedAsset(entity, asset.name);
        }

        var guid = BuiltLookupTable.Instance != null ? BuiltLookupTable.Instance.GetGuid(asset) : null;
        return string.IsNullOrWhiteSpace(guid)
            ? SnapshotRef.Missing("lookupAssetGuidMissing", source)
            : SnapshotRef.LookupAsset(guid, asset.GetType().FullName, asset.name);
    }

    /// <summary>
    /// A quest asset.
    /// </summary>
    /// <remarks>
    /// The compendium publishes a quest under its asset name, not under a lookup guid, so a guid
    /// reference here would resolve to nothing. A graph that refers to "this quest" carries no asset
    /// at all, which is a self reference rather than a missing one.
    /// </remarks>
    public static SnapshotRef? Quest(object? graphRef, string source)
    {
        if (graphRef == null) return null;
        var quest = GraphFields.Read<QuestData>(graphRef, "quest")
            ?? GraphFields.Read<QuestData>(graphRef, "questAsset");
        return quest == null
            ? SnapshotRef.Missing("dialogueQuestSelfReference", source)
            : SnapshotRef.NamedAsset("quest", quest.name);
    }

    /// <summary>
    /// The character group a branch reads, whether the graph names the quest or belongs to it.
    /// </summary>
    /// <remarks>
    /// `QuestObjectGraphRef` holds the quest asset and the object's id, and resolves "this quest"
    /// against the graph it lives in. An asset-time read does the same lookup by hand, because the
    /// runtime resolver needs a live flow graph.
    /// </remarks>
    public static CharacterGroupQuestObject? CharacterGroup(object? graphRef, FlowGraph? graph)
    {
        if (graphRef == null) return null;
        var quest = GraphFields.Read<QuestData>(graphRef, "questAsset") ?? AttachedQuest(graph);
        if (quest?.objects == null) return null;

        var objectId = GraphFields.ReadInt(graphRef, "questObjectID");
        foreach (var questObject in quest.objects)
        {
            if (questObject is CharacterGroupQuestObject group && group.objectID == objectId)
            {
                return group;
            }
        }

        return null;
    }

    /// <summary>
    /// The objective a check reads, as the quest names it.
    /// </summary>
    /// <remarks>
    /// `QuestObjectiveGraphRef` holds the quest asset, a phase id and an objective id. Reading them
    /// is the difference between "the authored objective" and "Question Ein": one quest graph gates
    /// 26 topics on nothing else, so the objective name is what separates two identical questions.
    /// </remarks>
    public static string? ObjectiveName(object? graphRef, FlowGraph? graph)
    {
        if (graphRef == null) return null;
        var quest = GraphFields.Read<QuestData>(graphRef, "questAsset") ?? AttachedQuest(graph);
        var phase = quest?.GetPhase(GraphFields.ReadInt(graphRef, "questPhaseID"));
        var objective = phase?.GetObjectiveById(GraphFields.ReadInt(graphRef, "questObjectiveID"));
        var name = objective?.objectiveName;
        return string.IsNullOrWhiteSpace(name) ? null : name;
    }

    /// <summary>The phase a check or a trigger watches, as the quest names it.</summary>
    public static string? PhaseName(object? graphRef, FlowGraph? graph)
    {
        if (graphRef == null) return null;
        var quest = GraphFields.Read<QuestData>(graphRef, "questAsset") ?? AttachedQuest(graph);
        var phase = quest?.GetPhase(GraphFields.ReadInt(graphRef, "questPhaseID"));
        return string.IsNullOrWhiteSpace(phase?.phaseName) ? null : phase!.phaseName;
    }

    /// <summary>The quest object a trigger watches, such as the location a player enters.</summary>
    public static string? QuestObjectName(object? graphRef, FlowGraph? graph)
    {
        if (graphRef == null) return null;
        var quest = GraphFields.Read<QuestData>(graphRef, "questAsset") ?? AttachedQuest(graph);
        if (quest?.objects == null) return null;

        var objectId = GraphFields.ReadInt(graphRef, "questObjectID");
        foreach (var questObject in quest.objects)
        {
            if (questObject != null && questObject.objectID == objectId)
            {
                return string.IsNullOrWhiteSpace(questObject.objectName) ? null : questObject.objectName;
            }
        }

        return null;
    }

    private static QuestData? AttachedQuest(FlowGraph? graph) =>
        graph is IQuestOwnedGraph owned ? owned.AttachedQuest : null;

    /// <summary>One character the game names by its record.</summary>
    public static DialogueParticipantSnapshot RecordParticipant(RecordReference? reference)
    {
        var id = reference?.RecordID;
        if (id == null || id.Value.IsNull())
        {
            return new DialogueParticipantSnapshot { Role = "unnamed" };
        }

        return new DialogueParticipantSnapshot
        {
            Role = "named",
            Ref = SnapshotRef.Record(id.Value.table, id.Value.subtable, id.Value.id, "CharacterRecord"),
        };
    }

    /// <summary>Who a node acts on or reads.</summary>
    public static DialogueParticipantSnapshot Participant(object? characterGraphRef, string source)
    {
        if (characterGraphRef == null)
        {
            return new DialogueParticipantSnapshot { Role = "speaker" };
        }

        var record = GraphFields.Read<RecordReference>(characterGraphRef, "characterRecord");
        if (record != null)
        {
            var id = record.RecordID;
            if (!id.IsNull())
            {
                return new DialogueParticipantSnapshot
                {
                    Role = "named",
                    Ref = SnapshotRef.Record(id.table, id.subtable, id.id, "CharacterRecord"),
                };
            }
        }

        // `GlobalCharacterSelection` names the participant by role: QuestObject, Player, DialogNPC or
        // Custom. A role is authored data, so it publishes as a role rather than as a missing entity.
        return new DialogueParticipantSnapshot
        {
            Role = GraphFields.ReadEnumName(characterGraphRef, "characterSelection") switch
            {
                "Player" => "player",
                "DialogNPC" => "speaker",
                "QuestObject" => "quest-object",
                _ => "unnamed",
            },
            Ref = null,
        };
    }
}
