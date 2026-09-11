using Ardenfall;
using ArdenfallCompendium.Dtos;

namespace ArdenfallCompendium.Entities.World;

/// <summary>
/// Reads the owners an authored scene object declares.
/// </summary>
/// <remarks>
/// A faction owner is an authored asset; a character owner is a record reference to a character the
/// compendium already publishes. Ownership is therefore a reference on the placement, and the edges
/// it projects belong to the read model rather than to the extractor.
/// </remarks>
public static class SceneOwners
{
    public static PlacedOwners Read(OwnedObject? owner)
    {
        var owners = new PlacedOwners();
        if (owner == null) return owners;

        foreach (var faction in owner.factionOwners ?? new())
        {
            if (faction == null) continue;
            var reference = SceneObjects.AssetRef(faction, "OwnedObject.factionOwners");
            if (reference != null) owners.FactionRefs.Add(reference);
        }

        foreach (var character in owner.characterOwners ?? new())
        {
            if (character == null) continue;
            var id = character.RecordID;
            if (id.IsNull()) continue;
            owners.CharacterRefs.Add(
                SnapshotRef.Record(id.table, id.subtable, id.id, "CharacterRecord"));
        }

        return owners;
    }
}
