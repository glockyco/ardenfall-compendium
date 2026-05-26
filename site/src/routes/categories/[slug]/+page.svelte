<script lang="ts">
  import ItemCategoryDetail from "$lib/components/categories/ItemCategoryDetail.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const category = $derived(data.presentation);
</script>

<svelte:head>
  <title>{category.name} | Categories | Ardenfall Compendium</title>
</svelte:head>

<a class="text-sm underline" href={data.itemCategoryRoute}>← back to categories</a>
<h1 class="mt-2 text-2xl font-bold">{category.name}</h1>
<ItemCategoryDetail presentation={category} items={data.items} />
