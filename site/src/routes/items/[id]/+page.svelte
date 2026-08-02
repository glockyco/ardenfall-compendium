<script lang="ts">
  import ItemHeader from "$lib/components/items/ItemHeader.svelte";
  import { itemNameForDisplay } from "$lib/components/items/itemName";
  import ItemPresentationPanel from "$lib/components/items/ItemPresentationPanel.svelte";
  import RelationshipSection from "$lib/components/relationships/RelationshipSection.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const item = $derived(data.presentation);
</script>

<svelte:head>
  <title>{itemNameForDisplay(item.name)} | Ardenfall Compendium</title>
</svelte:head>

<a class="text-sm underline" href={data.itemRoute}>← back to items</a>
<div class="mt-2">
  <ItemHeader {item} />
</div>

<div class="mt-6 grid gap-6">
  <ItemPresentationPanel {item} />
  {#each data.relationships as section (section.id)}
    <RelationshipSection {section} />
  {/each}
</div>
