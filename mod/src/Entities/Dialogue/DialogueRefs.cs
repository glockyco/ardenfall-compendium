using Ardenfall;
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
    /// <summary>The asset a field holds, or null when the field holds nothing.</summary>
    public static SnapshotRef? Asset(UnityObject? asset, string source)
    {
        if (asset == null) return null;
        var guid = BuiltLookupTable.Instance != null ? BuiltLookupTable.Instance.GetGuid(asset) : null;
        return string.IsNullOrWhiteSpace(guid)
            ? SnapshotRef.Missing("lookupAssetGuidMissing", source)
            : SnapshotRef.LookupAsset(guid, asset.GetType().FullName, asset.name);
    }

    /// <summary>A quest asset, which the compendium publishes by its lookup guid.</summary>
    public static SnapshotRef? Quest(object? graphRef, string source)
    {
        if (graphRef == null) return null;
        var quest = GraphFields.Read<QuestData>(graphRef, "quest")
            ?? GraphFields.Read<QuestData>(graphRef, "questAsset");
        return quest == null
            ? SnapshotRef.Missing("dialogueQuestSelfReference", source)
            : Asset(quest, source);
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
