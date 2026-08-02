<script lang="ts">
  import ItemCategoryOverview from "$lib/components/categories/ItemCategoryOverview.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Categories | Ardenfall Compendium</title>
  <meta
    name="description"
    content={`Browse ${data.categories.length} in-game inventory categories in the Ardenfall Compendium.`}
  />
  <link rel="canonical" href={data.itemCategoryRoute} />
  <meta property="og:title" content="Categories | Ardenfall Compendium" />
  <meta
    property="og:description"
    content={`Browse ${data.categories.length} in-game inventory categories in the Ardenfall Compendium.`}
  />
  <meta property="og:url" content={data.itemCategoryRoute} />
  <meta property="og:type" content="website" />
</svelte:head>

<h1 class="text-2xl font-bold">Categories</h1>
<p class="text-muted-foreground mt-2">Item categories and their in-game icon tints.</p>
<ItemCategoryOverview rows={data.categories} />
