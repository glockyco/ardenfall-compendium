<script lang="ts">
  import type { PlacedItemOverviewRow } from "$lib/server/read-models";

  let { rows }: { rows: PlacedItemOverviewRow[] } = $props();
</script>

{#if rows.length > 0}
  <ul class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {#each rows as placedItem (placedItem.id)}
      <li class="border-border bg-card rounded-lg border p-4">
        <a class="block underline-offset-4 hover:underline" href={placedItem.routePath}>
          <span class="block font-medium">{placedItem.name}</span>
        </a>
        {#if placedItem.stackCount > 1}
          <p class="text-muted-foreground mt-1 text-sm">Stack of {placedItem.stackCount}</p>
        {/if}
      </li>
    {/each}
  </ul>
{:else}
  <p class="text-muted-foreground mt-4">No placed items found.</p>
{/if}
