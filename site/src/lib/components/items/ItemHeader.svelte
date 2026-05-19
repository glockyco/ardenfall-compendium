<script lang="ts">
  import ItemIcon from "./ItemIcon.svelte";
  import type { ItemPresentationRow } from "$lib/server/read-models";

  let { item }: { item: ItemPresentationRow } = $props();
</script>

<header class="flex items-center gap-3">
  <ItemIcon src={item.displayIconSrc} size="lg" />
  <div>
    <h1 class="text-2xl font-bold">{item.name ?? item.id}</h1>
    <p class="text-muted-foreground">{item.itemType ?? item.variant}</p>
  </div>
</header>
