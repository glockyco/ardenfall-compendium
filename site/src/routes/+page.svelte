<script lang="ts">
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  // Pinned locale keeps prerendered output byte-stable across machines.
  const count = new Intl.NumberFormat("en-GB");
</script>

<svelte:head>
  <title>Ardenfall Compendium</title>
  <meta
    name="description"
    content="A static index of Ardenfall's game data, generated from a single game build."
  />
</svelte:head>

<h1 class="text-3xl font-semibold tracking-tight">Ardenfall Compendium</h1>

<p class="text-muted-foreground mt-4 max-w-2xl text-pretty">
  Items, spells, status effects, and world locations read straight out of
  {#if data.release}
    Ardenfall <span class="text-foreground font-medium">{data.release.gameVersion}</span>
  {:else}
    a single Ardenfall build
  {/if}
  and published as static pages. Nothing here is written by hand. Where the game data is missing or ambiguous
  the pages say so instead of guessing.
</p>

<nav aria-label="Sections" class="mt-10 max-w-2xl">
  <ul class="border-border border-t">
    {#each data.sections as section (section.id)}
      <li class="border-border border-b">
        <a
          href={section.href}
          class="group hover:bg-card -mx-3 flex items-baseline justify-between gap-4 rounded-sm px-3 py-3 transition-colors"
        >
          <span class="font-medium underline-offset-4 group-hover:underline">{section.label}</span>
          <span class="text-muted-foreground shrink-0 text-sm tabular-nums">
            {count.format(section.count)}
            {section.countLabel}
          </span>
        </a>
      </li>
    {/each}
  </ul>
</nav>
