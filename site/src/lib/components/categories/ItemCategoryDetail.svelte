<script lang="ts">
  import ItemIcon from "$lib/components/items/ItemIcon.svelte";
  import type { ItemCategoryPresentationRow, ItemOverviewRow } from "$lib/server/read-models";

  let {
    presentation,
    items,
  }: { presentation: ItemCategoryPresentationRow; items: ItemOverviewRow[] } = $props();
</script>

<div class="border-border bg-card mt-4 rounded-lg border p-5">
  <div class="flex items-center gap-3">
    <ItemIcon
      src={presentation.iconSrc ?? presentation.defaultItemIconSrc}
      displayIconColor={presentation.categoryColor}
      size="lg"
    />
    <div>
      <p class="text-muted-foreground text-sm font-medium tracking-wide uppercase">Category</p>
      <p>{presentation.itemCount} items</p>
    </div>
  </div>

  <section class="mt-6">
    <h2 class="text-lg font-semibold">Items</h2>
    {#if items.length > 0}
      <ul class="mt-2 space-y-2">
        {#each items as item (item.id)}
          <li>
            <a
              class="flex items-center gap-2 underline-offset-4 hover:underline"
              href={item.routePath}
            >
              <ItemIcon
                src={item.displayIconSrc}
                displayIconColor={item.displayIconColor}
                size="sm"
              />
              <span>{item.name ?? item.id}</span>
            </a>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="text-muted-foreground mt-2">No items in this category.</p>
    {/if}
  </section>
</div>
