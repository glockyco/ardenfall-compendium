<script lang="ts">
  import PlacedPlantOverview from "$lib/components/pickable-plants/PlacedPlantOverview.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Pickable Plants | Ardenfall Compendium</title>
  <meta
    name="description"
    content={`Browse ${data.plants.length} pickable plants in the Ardenfall Compendium.`}
  />
  <link rel="canonical" href={data.placedPlantRoute} />
  <meta property="og:title" content="Pickable Plants | Ardenfall Compendium" />
  <meta
    property="og:description"
    content={`Browse ${data.plants.length} pickable plants in the Ardenfall Compendium.`}
  />
  <meta property="og:url" content={data.placedPlantRoute} />
  <meta property="og:type" content="website" />
</svelte:head>

<h1 class="text-2xl font-bold">Pickable Plants</h1>
<p class="text-muted-foreground mt-2">
  {data.plants.length} plants placed in the world. Harvest experience is read from each placement.
</p>

<PlacedPlantOverview rows={data.plants} />
