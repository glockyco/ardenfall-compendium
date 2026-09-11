<script lang="ts">
  import BackLink from "$lib/components/navigation/BackLink.svelte";
  import RelationshipSection from "$lib/components/relationships/RelationshipSection.svelte";
  import WorldSpawnDetail from "$lib/components/world-spawns/WorldSpawnDetail.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const spawn = $derived(data.presentation);
</script>

<svelte:head>
  <title>{spawn.name} | World Spawns | Ardenfall Compendium</title>
  <meta name="description" content={`${spawn.name} in the Ardenfall Compendium.`} />
  <link rel="canonical" href={spawn.routePath} />
  <meta property="og:title" content={`${spawn.name} | World Spawns | Ardenfall Compendium`} />
  <meta property="og:description" content={`${spawn.name} in the Ardenfall Compendium.`} />
  <meta property="og:url" content={spawn.routePath} />
  <meta property="og:type" content="article" />
</svelte:head>

<BackLink href={data.worldSpawnRoute} label="world spawns" />
<h1 class="mt-2 text-2xl font-bold">{spawn.name}</h1>

<WorldSpawnDetail presentation={spawn} />

<div class="mt-6 grid gap-6">
  {#each data.relationships as section (section.id)}
    <RelationshipSection {section} />
  {/each}
</div>
