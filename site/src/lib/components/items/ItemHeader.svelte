<script lang="ts">
  import ItemIcon from "./ItemIcon.svelte";
  import { isPlaceholderItemName, itemNameForDisplay } from "./itemName";
  import type { ItemPresentationRow } from "$lib/server/read-models";

  let { item }: { item: ItemPresentationRow } = $props();
  const placeholderName = $derived(isPlaceholderItemName(item.name));
</script>

<header class="flex items-center gap-3">
  <ItemIcon src={item.displayIconSrc} displayIconColor={item.displayIconColor} size="lg" />
  <div>
    <h1 class="text-2xl font-bold">{itemNameForDisplay(item.name)}</h1>
    {#if placeholderName}
      <p class="text-muted-foreground text-sm">Source value: {item.name}</p>
    {/if}
    <p class="text-muted-foreground">{item.itemType ?? item.variant}</p>
  </div>
</header>
