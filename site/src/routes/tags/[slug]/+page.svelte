<script lang="ts">
  import ItemTagDetail from "$lib/components/tags/ItemTagDetail.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const tag = $derived(data.presentation);
</script>

<svelte:head>
  <title>{tag.name} | Tags | Ardenfall Compendium</title>
</svelte:head>

<a class="text-sm underline" href={data.itemTagRoute}>← back to tags</a>
<h1 class="mt-2 text-2xl font-bold">{tag.name}</h1>
<ItemTagDetail presentation={tag} items={data.items} />
