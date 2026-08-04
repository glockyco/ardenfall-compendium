<script lang="ts">
  import ItemIcon from "./ItemIcon.svelte";
  import type { ItemPresentationRow } from "$lib/server/read-models";

  let { item }: { item: ItemPresentationRow } = $props();
</script>

<header class="flex items-center gap-3">
  <ItemIcon src={item.displayIconSrc} displayIconColor={item.displayIconColor} size="lg" />
  <div>
    <h1 class="text-2xl font-bold">{item.name}</h1>
    {#if item.nameIsPlaceholder}
      <p class="text-muted-foreground text-sm">
        The game builds this name while you play, so the compendium cannot show one.
      </p>
    {/if}
    {#if item.itemType}
      <p class="text-muted-foreground">{item.itemType}</p>
    {/if}
  </div>
</header>
