<script lang="ts">
  import BackLink from "$lib/components/navigation/BackLink.svelte";
  import PlacedItemDetail from "$lib/components/placed-items/PlacedItemDetail.svelte";
  import RelationshipSection from "$lib/components/relationships/RelationshipSection.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const placedItem = $derived(data.presentation);
</script>

<svelte:head>
  <title>{placedItem.name} | Placed Items | Ardenfall Compendium</title>
  <meta name="description" content={`${placedItem.name} in the Ardenfall Compendium.`} />
  <link rel="canonical" href={placedItem.routePath} />
  <meta property="og:title" content={`${placedItem.name} | Placed Items | Ardenfall Compendium`} />
  <meta property="og:description" content={`${placedItem.name} in the Ardenfall Compendium.`} />
  <meta property="og:url" content={placedItem.routePath} />
  <meta property="og:type" content="article" />
</svelte:head>

<BackLink href={data.placedItemRoute} label="placed items" />
<h1 class="mt-2 text-2xl font-bold">{placedItem.name}</h1>

<PlacedItemDetail presentation={placedItem} />

<div class="mt-6 grid gap-6">
  {#each data.relationships as section (section.id)}
    <RelationshipSection {section} />
  {/each}
</div>
