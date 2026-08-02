/**
 * Wording for the one gap an item page states to a reader.
 *
 * An effect can name a status effect that this snapshot does not publish, in which case
 * the label cannot become a link. Saying so beside the effect is the honest rendering,
 * and it is deliberately a constant rather than a pipeline message. The diagnostics
 * column mixes maintainer telemetry with reader-facing gaps and nothing in the data
 * separates them, so forwarding those strings to a page once put "Equipped comparison
 * requires player inventory state." on 833 published pages.
 *
 * The upcoming item-to-status-effect edge resolves most of these into real links.
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
