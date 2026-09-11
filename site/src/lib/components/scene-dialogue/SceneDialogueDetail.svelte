<script lang="ts">
  import RichText from "$lib/components/content/RichText.svelte";
  import type { SceneDialoguePresentationRow } from "$lib/server/read-models";

  let { presentation }: { presentation: SceneDialoguePresentationRow } = $props();
  const coordinate = (value: number | null): string =>
    value === null ? "no coordinate" : Number.isInteger(value) ? `${value}` : value.toFixed(2);
</script>

<div class="border-border bg-card mt-4 rounded-lg border p-5">
  <dl class="grid gap-4 sm:grid-cols-2">
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">Dialogue</dt>
      <dd class="mt-1">{presentation.graphName}</dd>
    </div>
    {#if presentation.mapHref}
      <div>
        <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">Map link</dt>
        <dd class="mt-1">
          <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- map hrefs come from the static read model -->
          <a class="underline underline-offset-2" href={presentation.mapHref}
            >Show where this dialogue starts</a
          >
        </dd>
      </div>
    {/if}
  </dl>
</div>

<section class="border-border mt-6 rounded-lg border p-4" aria-labelledby="places-heading">
  <h2 id="places-heading" class="font-semibold">
    Where it starts ({presentation.placements.length})
  </h2>
  <ul class="mt-3 grid gap-2 text-sm sm:grid-cols-2">
    {#each presentation.placements as placement (placement.id)}
      <li class="border-border rounded-md border p-3">
        <span class="block font-medium">
          {placement.speakerName ?? "The game gives this speaker no name"}
        </span>
        <span class="text-muted-foreground block">
          {placement.cell} · {coordinate(placement.mapX)}, {coordinate(placement.mapY)}
        </span>
        {#if placement.interactionText}
          <span class="text-muted-foreground block">Prompt: {placement.interactionText}</span>
        {/if}
      </li>
    {/each}
  </ul>
</section>

<section class="border-border mt-6 rounded-lg border p-4" aria-labelledby="lines-heading">
  <h2 id="lines-heading" class="font-semibold">Lines ({presentation.lines.length})</h2>
  {#if presentation.lines.length > 0}
    <ul class="mt-3 grid gap-2 text-sm">
      {#each presentation.lines as line, index (`${presentation.id}-${index}`)}
        <li>
          <!--
            A topic is what the player can raise; a greeting is what the speaker opens with.
            Marking which is which keeps a bare line from reading as unprompted speech.
          -->
          <span class="text-muted-foreground mr-2 text-xs uppercase">
            {line.kind === "topic" ? "Topic" : "Greeting"}
          </span>
          <RichText richText={line.text} />
        </li>
      {/each}
    </ul>
  {:else}
    <p class="text-muted-foreground mt-2">This dialogue publishes no authored line.</p>
  {/if}
</section>
