namespace ArdenfallArchives.Entities.Item;

public sealed record ItemMeleeSnapshot(
    string Id,
    int DamageMin,
    int DamageMax,
    float? Reach,
    string WeaponClass);
