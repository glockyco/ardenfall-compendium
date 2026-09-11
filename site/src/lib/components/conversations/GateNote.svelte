<script lang="ts">
  import type { DialogueGate } from "$lib/server/entities/dialogue";
  import GateNote from "./GateNote.svelte";

  let { gate }: { gate: DialogueGate } = $props();

  /**
   * A composite states its own requirement and holds the checks that carry it.
   *
   * The game's most common gate is a list of checks. Printing the list itself says nothing, and
   * one quest graph asks the same question 17 times, once per witness: only the checks separate
   * them.
   */
  const composite = $derived(gate.children.length > 0);

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

  /**
   * The half of the sentence that follows the subject.
   *
   * A quest check names the quest it reads, so the state belongs after the quest's name: "Only
   * while Ashes at Dawn is started" rather than "Only while the quest is started Ashes at Dawn".
   */
  /**
   * The game's own comparison word, in a reader's words.
   *
   * `CompareMethod` names read as code on a page: "is LessOrEqualTo Akaga" says less than
   * "is at most Neutral with Akaga".
   */
  const comparison = (compare: string | null): string => {
    switch (compare) {
      case "LessOrEqualTo":
        return "at most";
      case "GreaterOrEqualTo":
        return "at least";
      case "LessThan":
        return "below";
      case "GreaterThan":
        return "above";
      case "Equal":
        return "exactly";
      case "NotEqual":
        return "anything but";
      default:
        return compare ?? "";
    }
  };

  const tail = (): string => {
    switch (gate.kind) {
      case "quest-state":
        return `is ${gate.value ?? "in the state the check names"}`;
      case "quest-phase":
        return "is at the authored phase";
      case "quest-objective":
        return "is at the authored objective";
      case "quest-variable":
        return "holds the authored value";
      case "faction-relationship":
        return `is ${comparison(gate.compare)} ${gate.value ?? "the authored tier"}`;
      default:
        return "";
    }
  };

  /** A quest check with no named subject still states which state it reads. */
  const fallbackSubject = $derived(
    gate.subjects.length === 0 && tail() !== ""
      ? gate.kind === "faction-relationship"
        ? "the faction"
        : "the quest"
      : null,
  );
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
        return "Only when standing with";
      case "stat-check":
        return `Requires a ${gate.value ?? ""} check of`.trim();
      case "quest-state":
      case "quest-phase":
      case "quest-objective":
      case "quest-variable":
        return "Only while";
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
      case "graph-variable":
        return gate.value
          ? `Only when the conversation's own flag ${gate.value} is set`
          : "Only when the conversation's own flag is set";
      case "chance":
        return "Sometimes, by chance";
      case "package-flag":
        return "Only when the speaker's routine sets the authored flag";
      default:
        return "";
    }
  };
</script>

{#if composite}
  <div class="text-muted-foreground space-y-1 text-sm">
    <p>
      {gate.childMode === "any" ? "Only when any of these holds:" : "Only when all of these hold:"}
    </p>
    <ul class="border-border ml-1 space-y-1 border-l pl-3">
      {#each gate.children as child, index (index)}
        <li><GateNote gate={child} /></li>
      {/each}
    </ul>
  </div>
{:else}
  <p class="text-muted-foreground text-sm">
    {#if gate.kind === "unread"}
      <!--
      The game checks something the extraction cannot name, such as whether the player is in
      battle. Saying so is accurate; presenting the choice as unconditional is not.
    -->
      Only when the game's own check passes. The compendium cannot name what it reads ({gate.authoredType}).
    {:else}
      {lead()}
      {#if fallbackSubject}{fallbackSubject}{/if}
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
      {tail()}
    {/if}
  </p>
{/if}
