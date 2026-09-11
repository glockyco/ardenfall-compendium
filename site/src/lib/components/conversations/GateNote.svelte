<script lang="ts">
  import type { DialogueGate } from "$lib/server/entities/dialogue";

  let { gate }: { gate: DialogueGate } = $props();

  /** Whose state the game reads. A role is authored data, not a missing character. */
  const who = (role: string | undefined): string =>
    role === "player"
      ? "the player"
      : role === "speaker"
        ? "the speaker"
        : role === "quest-object"
          ? "the quest's character"
          : "someone the data does not name";

  const subject = $derived(gate.participants[0]?.role);
  const negated = $derived(
    gate.invert || gate.compare === "notContainsAny" || gate.compare === "notContainsAll",
  );

  /**
   * What the game reads, in a reader's words.
   *
   * The phrasing follows the check's own kind. A list comparison keeps the game's own wording, from
   * `ListCompareMethodUtility.GetText`, rather than a phrase invented here.
   */
  const lead = (): string => {
    switch (gate.kind) {
      case "faction":
        return `Only when ${who(subject)} ${negated ? "is not in" : gate.compare === "containsAll" ? "is in all of" : "is in"}`;
      case "race":
        return `Only when ${who(subject)} ${negated ? "is not" : "is"}`;
      case "character-relationship":
        return `Only when ${who(subject)} stands ${gate.compare ?? ""} ${gate.value ?? ""} with the speaker`.trim();
      case "faction-relationship":
        return `Only when standing with the faction is ${gate.compare ?? ""} ${gate.value ?? ""}`.trim();
      case "stat-check":
        return `Requires a ${gate.value ?? ""} check of`.trim();
      case "quest-state":
        return `Only while the quest is ${gate.value ?? "in the state the check names"}`;
      case "quest-phase":
        return "Only during the authored phase of the quest";
      case "quest-objective":
        return "Only at the authored objective of the quest";
      case "quest-variable":
        return "Only when the quest's variable holds the authored value";
      case "quest-location":
      case "location-discovered":
        return `Only when ${negated ? "the player has not found" : "the player has found"}`;
      case "item-held":
        return `Only when ${who(subject)} ${negated ? "carries none of" : "carries"}`;
      case "already-spoken":
        return `Only after the player has spoken to ${who(subject)}`;
      case "death":
        return `Only when ${who(subject)} is ${negated ? "alive" : "dead"}`;
      case "once":
        return "Only the first time";
      case "detection":
        return `Only when the player is ${negated ? "unseen" : "seen"}`;
      case "package-flag":
        return "Only when the speaker's routine sets the authored flag";
      default:
        return "";
    }
  };
</script>

<p class="text-muted-foreground text-sm">
  {#if gate.kind === "unread"}
    <!--
      The game checks something the extraction cannot name, such as whether the player is in
      battle. Saying so is accurate; presenting the choice as unconditional is not.
    -->
    Only when the game's own check passes. The compendium cannot name what it reads ({gate.authoredType}).
  {:else}
    {lead()}
    {#each gate.subjects as subject, index (subject.entityId)}
      {#if index > 0},
      {/if}
      {#if subject.routePath}
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- route paths come from the static read model -->
        <a class="underline underline-offset-2" href={subject.routePath}>{subject.label}</a>
      {:else}
        {subject.label}
      {/if}
    {/each}
  {/if}
</p>
