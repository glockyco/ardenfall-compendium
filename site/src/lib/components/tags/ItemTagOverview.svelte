<script lang="ts">
  import type { ItemTagOverviewRow } from "$lib/server/read-models";

  let { rows }: { rows: ItemTagOverviewRow[] } = $props();
</script>

<ul class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
  {#each rows as row (row.id)}
    <li class="border-border bg-card rounded-lg border p-4">
      <a class="block underline-offset-4 hover:underline" href={row.routePath}>
        <span class="font-semibold">{row.name}</span>
        <span class="text-muted-foreground mt-1 block text-sm">{row.itemCount} items</span>
        {#if row.description}
          <span class="text-muted-foreground mt-2 block truncate text-sm">{row.description}</span>
        {/if}
      </a>
    </li>
  {/each}
</ul>

{#if rows.length === 0}
  <p class="text-muted-foreground mt-4">No tags.</p>
{/if}
