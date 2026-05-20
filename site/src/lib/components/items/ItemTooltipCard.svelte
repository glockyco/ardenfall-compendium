<script lang="ts">
  import RichText from "$lib/components/content/RichText.svelte";
  import ItemIcon from "./ItemIcon.svelte";
  import type { ItemPresentationRow } from "$lib/server/read-models";

  let { item }: { item: ItemPresentationRow } = $props();
</script>

<article
  class="bg-popover text-popover-foreground border-border w-72 rounded-lg border p-3 shadow-lg"
>
  <div class="flex items-center gap-2">
    <ItemIcon src={item.displayIconSrc} displayIconColor={item.displayIconColor} size="sm" />
    <div>
      <h3 class="font-semibold">{item.name ?? item.id}</h3>
      <p class="text-muted-foreground text-xs">{item.itemType ?? item.variant}</p>
    </div>
  </div>
  <p class="mt-3 text-sm leading-6"><RichText richText={item.description} /></p>
</article>
