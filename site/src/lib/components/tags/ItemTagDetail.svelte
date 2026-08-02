<script lang="ts">
  import EntityTable from "$lib/components/EntityTable.svelte";
  import type { ItemOverviewRow, ItemTagPresentationRow } from "$lib/server/read-models";

  type Column = {
    id: string;
    label: string;
    field: keyof ItemOverviewRow & string;
    renderer?: "text" | "itemNameWithIcon";
    sortable: boolean;
  };

  let {
    presentation,
    items,
    columns,
  }: {
    presentation: ItemTagPresentationRow;
    items: ItemOverviewRow[];
    columns: Column[];
  } = $props();
</script>

<div class="border-border bg-card mt-4 rounded-lg border p-5">
  <p class="text-muted-foreground text-sm font-medium tracking-wide uppercase">Tag</p>
  {#if presentation.description}
    <p class="mt-3">{presentation.description}</p>
  {/if}

  {#if items.length > 0}
    <section class="mt-6">
      <h2 class="text-lg font-semibold">Items</h2>
      <div class="mt-2 overflow-x-auto">
        <EntityTable {columns} rows={items} rowHref={(row) => row.routePath} />
      </div>
    </section>
  {:else}
    <p class="text-muted-foreground mt-6">No items use this tag.</p>
  {/if}
</div>
