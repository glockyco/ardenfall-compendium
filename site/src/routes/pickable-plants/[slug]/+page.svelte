<script lang="ts">
  import BackLink from "$lib/components/navigation/BackLink.svelte";
  import PlacedPlantDetail from "$lib/components/pickable-plants/PlacedPlantDetail.svelte";
  import RelationshipSection from "$lib/components/relationships/RelationshipSection.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const plant = $derived(data.presentation);
</script>

<svelte:head>
  <title>{plant.name} | Pickable Plants | Ardenfall Compendium</title>
  <meta name="description" content={`${plant.name} in the Ardenfall Compendium.`} />
  <link rel="canonical" href={plant.routePath} />
  <meta property="og:title" content={`${plant.name} | Pickable Plants | Ardenfall Compendium`} />
  <meta property="og:description" content={`${plant.name} in the Ardenfall Compendium.`} />
  <meta property="og:url" content={plant.routePath} />
  <meta property="og:type" content="article" />
</svelte:head>

<BackLink href={data.placedPlantRoute} label="pickable plants" />
<h1 class="mt-2 text-2xl font-bold">{plant.name}</h1>

<PlacedPlantDetail presentation={plant} />

<div class="mt-6 grid gap-6">
  {#each data.relationships as section (section.id)}
    <RelationshipSection {section} />
  {/each}
</div>
