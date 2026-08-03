<script lang="ts">
  import EntityTable from "$lib/components/EntityTable.svelte";
  import ItemIcon from "$lib/components/items/ItemIcon.svelte";
  import type { ItemCategoryPresentationRow, ItemOverviewRow } from "$lib/server/read-models";

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
    variantRoutePath,
  }: {
    presentation: ItemCategoryPresentationRow;
    items: ItemOverviewRow[];
    columns: Column[];
    variantRoutePath: string | null;
  } = $props();

  const columnLabel = (column: Record<string, unknown>): string | null => {
    if (column.isItemIconAndCategory === true) return "Item icon";
    if (column.itemName === true) return "Name";
    if (column.itemValue === true) return "Value";
    if (typeof column.label !== "string") return null;
    const label = column.label.replace(/<sprite\b[^>]*>/g, "").trim();
    return label || null;
  };
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
  <p class="mt-3">
    This category is an in-game inventory tab. It groups items using the game's category assignment.
    {#if variantRoutePath}
      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- variant routes are generated from the static read model -->
      <a class="underline underline-offset-2" href={variantRoutePath}
        >View the matching item variant.</a
      >
    {/if}
  </p>

  {#if presentation.columns.length > 0}
    <section class="border-border mt-6 border-t pt-5">
      <h2 class="font-semibold">Inventory columns</h2>
      <ul class="text-muted-foreground mt-3 grid gap-2 text-sm sm:grid-cols-2">
        {#each presentation.columns as column, index (`${columnLabel(column) ?? "column"}-${index}`)}
          {#if columnLabel(column)}
            <li>{columnLabel(column)}</li>
          {/if}
        {/each}
      </ul>
    </section>
  {/if}

  {#if items.length > 0}
    <section class="mt-6">
      <h2 class="text-lg font-semibold">Items</h2>
      <div class="mt-2 overflow-x-auto">
        <EntityTable {columns} rows={items} rowHref={(row) => row.routePath} />
      </div>
    </section>
  {:else}
    <p class="text-muted-foreground mt-6">No items in this category.</p>
  {/if}
</div>
