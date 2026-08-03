const spellEffectLabels: Record<string, string> = {
  "apply-status-to-self": "Applies a status effect to the caster",
  "apply-status-to-target": "Applies a status effect to a target",
  projectile: "Fires a projectile",
  "area-of-effect": "Creates an area effect",
  "ranged-attack": "Makes a ranged attack",
  fling: "Throws the target",
  trap: "Sets a trap",
  "spawn-prefab": "Spawns an object",
  "projectile-prefab": "Spawns a projectile",
  "raise-dead": "Raises the dead",
  "raise-dead-area": "Raises nearby dead",
  "summon-character": "Summons a character",
  "summon-decoy": "Summons a decoy",
  "increase-companion-time": "Extends companion time",
};

/** Convert stored effect tokens into words that a reader can understand. */
export function spellEffectLabel(kind: string): string {
  return spellEffectLabels[kind] ?? "Other spell effect";
}
