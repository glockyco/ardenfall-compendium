<script lang="ts">
  import ItemCategoryOverview from "$lib/components/categories/ItemCategoryOverview.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Categories | Ardenfall Compendium</title>
</svelte:head>

<h1 class="text-2xl font-bold">Categories</h1>
<p class="text-muted-foreground mt-2">Item categories and their in-game icon tints.</p>
<ItemCategoryOverview rows={data.categories} />
