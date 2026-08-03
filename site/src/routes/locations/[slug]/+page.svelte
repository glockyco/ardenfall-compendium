<script lang="ts">
  import BackLink from "$lib/components/navigation/BackLink.svelte";
  import LocationDetail from "$lib/components/locations/LocationDetail.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const location = $derived(data.presentation);
</script>

<svelte:head>
  <title>{location.name} | Locations | Ardenfall Compendium</title>
  <meta name="description" content={`${location.name} in the Ardenfall Compendium.`} />
  <link rel="canonical" href={location.routePath} />
  <meta property="og:title" content={`${location.name} | Locations | Ardenfall Compendium`} />
  <meta property="og:description" content={`${location.name} in the Ardenfall Compendium.`} />
  <meta property="og:url" content={location.routePath} />
  <meta property="og:type" content="article" />
</svelte:head>

<BackLink href={data.locationRoute} label="locations" />
<h1 class="mt-2 text-2xl font-bold">{location.name}</h1>

<LocationDetail presentation={location} />
