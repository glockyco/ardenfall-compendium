<script lang="ts">
  import ItemIcon from "$lib/components/items/ItemIcon.svelte";
  import type { ItemOverviewRow, ItemTagPresentationRow } from "$lib/server/read-models";

  let { presentation, items }: { presentation: ItemTagPresentationRow; items: ItemOverviewRow[] } =
    $props();
</script>

<div class="border-border bg-card mt-4 rounded-lg border p-5">
  <p class="text-muted-foreground text-sm font-medium tracking-wide uppercase">Tag</p>
  {#if presentation.description}
    <p class="mt-3">{presentation.description}</p>
  {/if}

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
      <p class="text-muted-foreground mt-2">No items use this tag.</p>
    {/if}
  </section>
</div>
