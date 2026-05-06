namespace ArdenfallArchives.Entities.Item;

public sealed record ItemEquipmentSnapshot(
    string Id,
    string EquipSlot,
    string? ArmorClass,
    int? DurabilityMax);
