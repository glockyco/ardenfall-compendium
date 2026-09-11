<script lang="ts">
  import ScriptStep from "./ScriptStep.svelte";
  import type { DialoguePresentationRow } from "$lib/server/entities/dialogue";

  let { presentation }: { presentation: DialoguePresentationRow } = $props();

  const holderLabel = (kind: string): string =>
    kind === "character"
      ? "A character definition"
      : kind === "character-module"
        ? "A character module"
        : kind === "quest-character"
          ? "A quest character"
          : kind === "quest-character-group"
            ? "A quest character group"
            : kind === "quest-scene-object"
              ? "A quest scene object"
              : "A scene placement";
</script>

<div class="border-border bg-card mt-4 rounded-lg border p-5">
  <dl class="grid gap-4 sm:grid-cols-2">
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">Dialogue</dt>
      <dd class="mt-1">{presentation.graphName}</dd>
    </div>
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">Reached by</dt>
      <dd class="mt-1">
        <ul>
          {#each presentation.holders as holder, index (index)}
            <li>
              {holderLabel(holder.kind)}{#if holder.link}:
                {#if holder.link.routePath}
                  <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- route paths come from the static read model -->
                  <a class="underline underline-offset-2" href={holder.link.routePath}
                    >{holder.link.label}</a
                  >
                {:else}{holder.link.label}{/if}
              {:else if holder.label}: {holder.label}{/if}
            </li>
          {/each}
        </ul>
      </dd>
    </div>
  </dl>
</div>

<section class="border-border mt-6 rounded-lg border p-4" aria-labelledby="openers-heading">
  <h2 id="openers-heading" class="font-semibold">
    Openers ({presentation.script.openers.length})
  </h2>
  {#if presentation.script.openers.length > 0}
    <p class="text-muted-foreground mt-1 text-sm">
      The game picks one. They are alternatives, in the order it prefers them.
    </p>
    <div class="mt-3 grid gap-4">
      {#each presentation.script.openers as opener, index (index)}
        <ScriptStep step={opener} />
      {/each}
    </div>
  {:else}
    <p class="text-muted-foreground mt-2">This conversation opens with no authored greeting.</p>
  {/if}
</section>

{#if presentation.script.topics.length > 0}
  <section class="border-border mt-6 rounded-lg border p-4" aria-labelledby="topics-heading">
    <h2 id="topics-heading" class="font-semibold">
      What the player can raise ({presentation.script.topics.length})
    </h2>
    <p class="text-muted-foreground mt-1 text-sm">
      The game offers every topic whose requirement is met, in the order it prefers them.
    </p>
    <div class="mt-3 grid gap-4">
      {#each presentation.script.topics as topic, index (index)}
        <ScriptStep step={topic} />
      {/each}
    </div>
  </section>
{/if}

{#if presentation.script.starts.length > 0}
  <section class="border-border mt-6 rounded-lg border p-4" aria-labelledby="starts-heading">
    <h2 id="starts-heading" class="font-semibold">
      Other entry points ({presentation.script.starts.length})
    </h2>
    <p class="text-muted-foreground mt-1 text-sm">
      The game reaches these from elsewhere: a quest event, or another conversation.
    </p>
    <div class="mt-3 grid gap-4">
      {#each presentation.script.starts as start, index (index)}
        <ScriptStep step={start} />
      {/each}
    </div>
  </section>
{/if}

{#if presentation.optionCount === 0}
  <p class="text-muted-foreground mt-4 text-sm">This conversation offers the player no choice.</p>
{/if}
