<script lang="ts">
  import WorldSpawnOverview from "$lib/components/world-spawns/WorldSpawnOverview.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>World Spawns | Ardenfall Compendium</title>
  <meta
    name="description"
    content={`Browse ${data.worldSpawns.length} world spawns in the Ardenfall Compendium.`}
  />
  <link rel="canonical" href={data.worldSpawnRoute} />
  <meta property="og:title" content="World Spawns | Ardenfall Compendium" />
  <meta
    property="og:description"
    content={`Browse ${data.worldSpawns.length} world spawns in the Ardenfall Compendium.`}
  />
  <meta property="og:url" content={data.worldSpawnRoute} />
  <meta property="og:type" content="website" />
</svelte:head>

<h1 class="text-2xl font-bold">World Spawns</h1>
<p class="text-muted-foreground mt-2">
  {data.worldSpawns.length} places where the authored scenes instantiate a character.
</p>

<WorldSpawnOverview rows={data.worldSpawns} />
