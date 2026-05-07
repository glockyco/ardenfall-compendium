namespace ArdenfallCompendium.Entities.Item;

public sealed record ItemMeleeSnapshot(
    string Id,
    float Damage,
    float? CriticalHitChance,
    int MeleeDurabilityMax,
    bool? CanBlock);
