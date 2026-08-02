import type { ItemPresentationDiagnostic } from "$lib/server/read-models";

/**
 * Reader-facing wording for diagnostics that surface on the page.
 *
 * The pipeline writes diagnostics for maintainers, so its phrasing names fields and
 * resolution steps. Keying on the diagnostic code keeps that contract stable while the
 * page says what the gap means to someone reading it. A code with no entry here renders
 * the pipeline message unchanged, which is the honest default for anything unmapped.
 */
const readerFacingMessage: Record<string, string> = {
  unresolvedEffectTarget:
    "This effect names a status effect that this snapshot does not publish as its own page.",
};

export function itemDiagnosticMessage(diagnostic: ItemPresentationDiagnostic): string {
  return readerFacingMessage[diagnostic.code] ?? diagnostic.message;
}
