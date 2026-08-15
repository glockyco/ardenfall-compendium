<script lang="ts">
  import BackLink from "$lib/components/navigation/BackLink.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const race = $derived(data.presentation);
</script>

<svelte:head>
  <title>{race.name} | Character Races | Ardenfall Compendium</title>
  <meta
    name="description"
    content={`${race.name} and its authored character naming vocabulary in the Ardenfall Compendium.`}
  />
  <link rel="canonical" href={race.routePath} />
  <meta property="og:title" content={`${race.name} | Character Races | Ardenfall Compendium`} />
  <meta
    property="og:description"
    content={`${race.name} and its authored character naming vocabulary in the Ardenfall Compendium.`}
  />
  <meta property="og:url" content={race.routePath} />
  <meta property="og:type" content="article" />
</svelte:head>

<BackLink href={data.characterRaceRoute} label="character races" />
<h1 class="mt-2 text-2xl font-bold">{race.name}</h1>
{#if race.name === "Unnamed race"}
  <p class="text-muted-foreground mt-2">
    The game defines no player-visible name for this race; characters that use it provide its
    reader-facing identity.
  </p>
{/if}

<section class="mt-6 grid gap-3">
  <h2 class="text-xl font-semibold">Naming vocabulary</h2>
  <p>
    A character of this race without an authored name receives one built from these name sets. Each
    name set contributes one word; the words join in set order. Each word is synthesised by a Markov
    chain of the set's generation order from that set's seed vocabulary.
  </p>
  <p class="text-muted-foreground">
    The vocabulary below is the complete authored seed list. No generated name is displayed: a
    generated result would be one roll by the compendium, indistinguishable from an authored game
    value on this page.
  </p>
</section>

{#if race.nameSets.length > 0}
  <ol class="mt-6 grid gap-6">
    {#each race.nameSets as nameSet, setIndex (nameSet.id)}
      <li class="border-border bg-card rounded-lg border p-4">
        <h2 class="text-lg font-semibold">
          Name set {setIndex + 1}: <span class="font-mono text-base">{nameSet.id}</span>
        </h2>
        <p class="text-muted-foreground mt-1 text-sm">
          {nameSet.seedCount}
          {nameSet.seedCount === 1 ? "seed" : "seeds"}; generation order
          {nameSet.generationOrder}.
        </p>
        <ul class="mt-4 grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {#each nameSet.seeds as seed, seedIndex (seedIndex)}
            <li class="font-mono text-sm">
              {seed.name} <span class="text-muted-foreground">(weight {seed.weight})</span>
            </li>
          {/each}
        </ul>
      </li>
    {/each}
  </ol>
{:else}
  <p class="text-muted-foreground mt-6">This race has no authored name-set vocabulary.</p>
{/if}
