<script lang="ts">
  import type { QuestLogic } from "$lib/server/entities/quest";

  let { logic }: { logic: QuestLogic } = $props();

  /**
   * What the game watches for, in a reader's words.
   *
   * Every phrase is an authored declaration. None says that a reader can reach, must reach, or
   * cannot reach anything, because the walk reads fields and never runs a graph.
   */
  const trigger = (kind: string): string => {
    switch (kind) {
      case "quest-starts":
        return "When the quest starts";
      case "phase-active":
        return "While the phase is active";
      case "objective-active":
        return "While the objective is active";
      case "enters-location":
        return "When a character enters";
      case "acquires-item":
        return "When a character acquires";
      case "sheathes-item":
        return "When a character sheathes";
      case "character-dies":
        return "When a character dies";
      case "character-damaged":
        return "When a character is damaged";
      case "character-pickpocketed":
        return "When a character is pickpocketed";
      case "group-spawns":
        return "When a character group spawns";
      case "quest-variable-changes":
        return "When a quest variable changes";
      case "quest-phase-changes":
        return "When the quest's phase changes";
      default:
        return "On a state the compendium cannot name";
    }
  };

  const effect = (kind: string): string => {
    switch (kind) {
      case "quest-state":
        return "Sets the quest's state";
      case "quest-phase":
        return "Sets the quest's phase";
      case "quest-objective":
        return "Sets an objective's state";
      case "quest-variable":
        return "Sets a quest variable";
      case "item":
        return "Gives";
      case "journal":
        return "Adds a journal entry";
      case "achievement":
        return "Grants the achievement";
      case "experience":
        return "Gives experience";
      case "money":
        return "Gives gold";
      case "teleport":
        return "Teleports a character to";
      case "map-marker":
        return "Adds a map marker for";
      default:
        return kind.replaceAll("-", " ");
    }
  };
</script>

{#if logic.triggers.length > 0 || logic.effects.length > 0}
  <section class="border-border rounded-lg border p-4">
    <h2 class="font-semibold">What the quest's logic declares</h2>
    <p class="text-muted-foreground mt-1 text-sm">
      Read from the quest's own graph. These are authored declarations, not a route through the
      quest.
    </p>

    {#if logic.triggers.length > 0}
      <h3 class="mt-3 text-sm font-medium">Watches for</h3>
      <ul class="mt-1 grid gap-1 text-sm">
        {#each logic.triggers as item, index (index)}
          <li class="border-border border-l-2 pl-3">
            {trigger(item.kind)}
            {#if item.label}<span class="font-medium">{item.label}</span>{/if}
            {#each item.subjects as subject, subjectIndex (subjectIndex)}
              {#if subject.routePath}
                <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- route paths come from the static read model -->
                <a class="underline underline-offset-2" href={subject.routePath}>{subject.label}</a>
              {:else}{subject.label}{/if}
            {/each}
          </li>
        {/each}
      </ul>
    {/if}

    {#if logic.effects.length > 0}
      <h3 class="mt-3 text-sm font-medium">Changes</h3>
      <ul class="mt-1 grid gap-1 text-sm">
        {#each logic.effects as item, index (index)}
          <li class="border-border border-l-2 pl-3">
            {effect(item.kind)}
            {#if item.subject}
              {#if item.subject.routePath}
                <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- route paths come from the static read model -->
                <a class="underline underline-offset-2" href={item.subject.routePath}
                  >{item.subject.label}</a
                >
              {:else}{item.subject.label}{/if}
            {/if}
            {#if item.amount !== null}<span class="text-muted-foreground">
                ({item.amount})</span
              >{:else if item.amountLabel}<span class="text-muted-foreground">
                ({item.amountLabel})</span
              >{/if}
          </li>
        {/each}
      </ul>
    {/if}

    {#if logic.unmodelled.length > 0}
      <p class="text-muted-foreground mt-3 text-xs">
        The graph also holds {logic.unmodelled.reduce((total, entry) => total + entry.count, 0)} node(s)
        of {logic.unmodelled.length} type(s) the compendium does not model.
      </p>
    {/if}
  </section>
{/if}
