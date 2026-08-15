/**
 * The authored availability flags a page may state.
 *
 * A kind carries one authored meaning and one wording, so adding a kind obliges
 * whoever adds it to write that wording in `AvailabilityNotice.svelte`. The
 * subject is the noun the sentence uses, supplied by the caller, so a new entity
 * family states its flags without touching the component.
 */
export type AvailabilityKind = "disabled" | "hidden-in-quest-ui" | "debug-only";

export type AvailabilityFlag = {
  kind: AvailabilityKind;
  subject: string;
};
