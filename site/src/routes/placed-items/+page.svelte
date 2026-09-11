<script lang="ts">
  import PlacedItemOverview from "$lib/components/placed-items/PlacedItemOverview.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Placed Items | Ardenfall Compendium</title>
  <meta
    name="description"
    content={`Browse ${data.placedItems.length} items the world places in the Ardenfall Compendium.`}
  />
  <link rel="canonical" href={data.placedItemRoute} />
  <meta property="og:title" content="Placed Items | Ardenfall Compendium" />
  <meta
    property="og:description"
    content={`Browse ${data.placedItems.length} items the world places in the Ardenfall Compendium.`}
  />
  <meta property="og:url" content={data.placedItemRoute} />
  <meta property="og:type" content="website" />
</svelte:head>

<h1 class="text-2xl font-bold">Placed Items</h1>
<p class="text-muted-foreground mt-2">
  {data.placedItems.length} copies of items lie in the world. Durability and enchantments belong to the
  copy.
</p>

<PlacedItemOverview rows={data.placedItems} />
