/**
 * Wording for the one gap an item page states to a reader.
 *
 * A status-effect fact can name an effect this snapshot does not publish, in which case
 * the label cannot become a link. Saying so beside the effect is the honest rendering,
 * and it is deliberately a constant rather than a pipeline message. The diagnostics
 * column mixes maintainer telemetry with reader-facing gaps and nothing in the data
 * separates them, so forwarding those strings to a page once put "Equipped comparison
 * requires player inventory state." on 833 published pages.
 *
 * This is specific to status effects and callers must check the kind. A spell fact can
 * carry a null target too, and showing this sentence on one told readers a spell was an
 * unpublished status effect. Both kinds resolve in the current snapshot, all 552 facts of
 * them, and neither `itemStatusEffectUnresolved` nor `itemSpellUnresolved` fires, so this
 * sentence renders nowhere today. It stays because the pipeline diagnoses the case and
 * tests cover it, which is the condition this repo sets for keeping a recovery path.
 */
export const UNRESOLVED_EFFECT_TARGET =
  "This effect names a status effect that this snapshot does not publish as its own page.";

/**
 * Reader-facing names for the effect kinds the pipeline emits.
 *
 * The stored value is an identifier, so "status-effect" would otherwise reach the page
 * verbatim beside the effect's name. An unmapped kind falls through unchanged rather
 * than being hidden, since the kind is a real distinction a reader can use and an
 * unfamiliar one is better shown raw than dropped.
 */
const effectKindLabels: Record<string, string> = {
  "status-effect": "Status effect",
  spell: "Spell",
};

export function effectKindLabel(kind: string): string {
  return effectKindLabels[kind] ?? kind;
}

/**
 * Reader-facing names for the effect roles the pipeline emits.
 *
 * These phrases follow the declaring item-data fields. They distinguish the two spells
 * and the three ways a status effect reaches a reader without adding a game mechanic.
 */
const effectRoleLabels: Record<string, string> = {
  spellDataJson: "Primary cast",
  secondarySpellDataJson: "Secondary cast",
  statusEffectsJson: "Applies when consumed",
  areaOfEffectJson: "Applies where potion lands",
  bleedStatusEffectJson: "Weapon-inflicted bleed",
};

export function effectRoleLabel(source: string | null | undefined, kind: string): string {
  return (source && effectRoleLabels[source]) ?? effectKindLabel(kind);
}
