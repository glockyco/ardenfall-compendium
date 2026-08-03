<script lang="ts">
  import LocationOverview from "$lib/components/locations/LocationOverview.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Locations | Ardenfall Compendium</title>
  <meta
    name="description"
    content={`Browse ${data.locations.length} locations in the Ardenfall Compendium.`}
  />
  <link rel="canonical" href={data.locationRoute} />
  <meta property="og:title" content="Locations | Ardenfall Compendium" />
  <meta
    property="og:description"
    content={`Browse ${data.locations.length} locations in the Ardenfall Compendium.`}
  />
  <meta property="og:url" content={data.locationRoute} />
  <meta property="og:type" content="website" />
</svelte:head>

<h1 class="text-2xl font-bold">Locations</h1>
<p class="text-muted-foreground mt-2">{data.locations.length} locations in the game data.</p>

<LocationOverview rows={data.locations} />
