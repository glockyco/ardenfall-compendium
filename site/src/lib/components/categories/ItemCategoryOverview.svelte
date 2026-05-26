<script lang="ts">
  import ItemIcon from "$lib/components/items/ItemIcon.svelte";
  import type { ItemCategoryOverviewRow } from "$lib/server/read-models";

  let { rows }: { rows: ItemCategoryOverviewRow[] } = $props();
</script>

<ul class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
  {#each rows as row (row.id)}
    <li class="border-border bg-card rounded-lg border p-4">
      <a class="flex items-center gap-3 underline-offset-4 hover:underline" href={row.routePath}>
        <ItemIcon
          src={row.iconSrc ?? row.defaultItemIconSrc}
          displayIconColor={row.categoryColor}
          size="md"
        />
        <span>
          <span class="font-semibold">{row.name}</span>
          <span class="text-muted-foreground block text-sm">{row.itemCount} items</span>
        </span>
      </a>
    </li>
  {/each}
</ul>

{#if rows.length === 0}
  <p class="text-muted-foreground mt-4">No categories.</p>
{/if}
