<script lang="ts">
  import type { DialogueOutcome } from "$lib/server/entities/dialogue";

  let { outcomes }: { outcomes: DialogueOutcome[] } = $props();

  /** What the game does, in the words a reader uses. */
  const verb = (outcome: DialogueOutcome): string => {
    switch (outcome.kind) {
      case "experience":
        return outcome.amount === null ? "Awards experience" : `+${outcome.amount} experience`;
      case "money":
        return outcome.amount === null
          ? "Changes the player's money"
          : outcome.amount < 0
            ? `${outcome.amount} gold`
            : `+${outcome.amount} gold`;
      case "item":
        return outcome.amount !== null && outcome.amount > 1 ? `Gives ${outcome.amount}×` : "Gives";
      case "teleport":
        return "Teleports to";
      case "combat-start":
        return "Starts combat";
      case "character-death":
        return "Kills";
      case "character-despawn":
        return "Removes";
      case "quest-state":
        return outcome.amountLabel === null
          ? "Changes the quest"
          : `Sets the quest ${outcome.amountLabel}`;
      case "quest-phase":
        return "Advances";
      case "quest-objective":
        return outcome.amountLabel === null
          ? "Changes an objective of"
          : `Sets an objective ${outcome.amountLabel} in`;
      case "quest-variable":
        return "Changes a variable of";
      case "quest-event":
        return "Triggers an event in";
      case "character-relationship":
        return "Changes how the speaker feels about the player";
      case "faction-relationship":
        return "Changes standing with";
      case "merchant":
        return "Opens the merchant's stock";
      case "training":
        return "Opens training";
      case "repair":
        return "Opens repairs";
      case "imprisonment":
        return "Sends the player to prison";
      case "map-marker":
        return "Marks the map";
      case "achievement":
        return "Grants an achievement";
      case "package":
        return "Changes the speaker's routine";
      case "dialogue-member":
        return "Adds a speaker to the conversation";
      default:
        // An outcome kind the extraction does not read. Naming the authored node is honest; a
        // silent omission would read as a choice with no consequence.
        return `Runs ${outcome.authoredType}`;
    }
  };
</script>

<ul class="mt-2 flex flex-wrap gap-2">
  {#each outcomes as outcome, index (`${outcome.kind}-${index}`)}
    <li class="border-border bg-card rounded-full border px-3 py-1 text-xs">
      {verb(outcome)}
      {#if outcome.target}
        {#if outcome.target.routePath}
          <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- route paths come from the static read model -->
          <a class="underline underline-offset-2" href={outcome.target.routePath}
            >{outcome.target.label}</a
          >
        {:else}
          {outcome.target.label}
        {/if}
      {/if}
    </li>
  {/each}
</ul>
