<script lang="ts">
  import BackLink from "$lib/components/navigation/BackLink.svelte";
  import ItemCategoryDetail from "$lib/components/categories/ItemCategoryDetail.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const category = $derived(data.presentation);
</script>

<svelte:head>
  <title>{category.name} | Categories | Ardenfall Compendium</title>
  <meta
    name="description"
    content={`In-game inventory category ${category.name} with ${category.itemCount} items in the Ardenfall Compendium.`}
  />
  <link rel="canonical" href={category.routePath} />
  <meta property="og:title" content={`${category.name} | Categories | Ardenfall Compendium`} />
  <meta
    property="og:description"
    content={`In-game inventory category ${category.name} with ${category.itemCount} items in the Ardenfall Compendium.`}
  />
  <meta property="og:url" content={category.routePath} />
  <meta property="og:type" content="article" />
</svelte:head>

<BackLink href={data.itemCategoryRoute} label="categories" />
<h1 class="mt-2 text-2xl font-bold">{category.name}</h1>
<ItemCategoryDetail
  presentation={category}
  items={data.items}
  columns={data.columns}
  variantRoutePath={data.variantRoutePath}
/>
