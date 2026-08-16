<script lang="ts">
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Character Races | Ardenfall Compendium</title>
  <meta
    name="description"
    content={`Browse ${data.races.length} character races in the Ardenfall Compendium.`}
  />
  <link rel="canonical" href={data.characterRaceRoute} />
  <meta property="og:title" content="Character Races | Ardenfall Compendium" />
  <meta
    property="og:description"
    content={`Browse ${data.races.length} character races in the Ardenfall Compendium.`}
  />
  <meta property="og:url" content={data.characterRaceRoute} />
  <meta property="og:type" content="website" />
</svelte:head>

<h1 class="text-2xl font-bold">Character Races</h1>
<p class="text-muted-foreground mt-2">
  {data.races.length} reader-facing character races.
</p>

{#if data.races.length > 0}
  <ul class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {#each data.races as race (race.id)}
      <li class="border-border bg-card rounded-lg border p-4">
        <a class="block underline-offset-4 hover:underline" href={race.routePath}>
          <span class="block font-medium">{race.name}</span>
          <span class="text-muted-foreground text-sm">
            {race.variantCount}
            {race.variantCount === 1 ? "variant" : "variants"}
          </span>
        </a>
      </li>
    {/each}
  </ul>
{:else}
  <p class="text-muted-foreground mt-4">No character races found.</p>
{/if}
