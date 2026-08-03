<script lang="ts" generics="T extends { id: string | number }">
  import ItemIcon from "$lib/components/items/ItemIcon.svelte";
  import { itemNameForList, type ItemNameRow } from "$lib/components/items/itemName";
  type Column = {
    id: string;
    label: string;
    field: keyof T & string;
    renderer?: "text" | "itemNameWithIcon";
    sortable?: boolean;
  };

  type Props = {
    rows: T[];
    columns: Column[];
    rowHref?: (row: T) => string;
  };

  let { rows, columns, rowHref }: Props = $props();

  const duplicateNames = $derived.by(() => {
    const counts: Record<string, number> = Object.create(null) as Record<string, number>;
    for (const row of rows) {
      const name = (row as T & ItemNameRow).name;
      if (name) counts[name] = (counts[name] ?? 0) + 1;
    }
    return counts;
  });

  function cellValue(row: T, col: Column): string | number {
    const value = row[col.field];
    if (col.renderer === "itemNameWithIcon") {
      return itemNameForList(row as T & ItemNameRow, duplicateNames);
    }
    return (value as string | number | null | undefined) ?? "";
  }

  function iconSrc(row: T): string | null {
    const value = (row as T & { displayIconSrc?: unknown }).displayIconSrc;
    return typeof value === "string" && value.length > 0 ? value : null;
  }

  function iconColor(row: T): string | null {
    const value = (row as T & { displayIconColor?: unknown }).displayIconColor;
    return typeof value === "string" && value.length > 0 ? value : null;
  }
</script>

<table class="w-full text-left text-sm">
  {#if rows.length > 0}
    <thead class="bg-muted text-muted-foreground">
      <tr>
        {#each columns as col (col.id)}
          <th scope="col" class="p-2">{col.label}</th>
        {/each}
      </tr>
    </thead>
  {/if}
  <tbody>
    {#each rows as row (row.id)}
      <tr class="border-border hover:bg-muted/40 border-b">
        {#each columns as col, i (col.id)}
          <td class="p-2">
            {#if col.renderer === "itemNameWithIcon"}
              <span class="flex items-center gap-2">
                <ItemIcon src={iconSrc(row)} displayIconColor={iconColor(row)} size="sm" />
                {#if i === 0 && rowHref}
                  <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the rowHref callback is caller-supplied and is expected to wrap with resolve() at the call site -->
                  <a href={rowHref(row)} class="underline">{cellValue(row, col)}</a>
                {:else}
                  <span>{cellValue(row, col)}</span>
                {/if}
              </span>
            {:else if i === 0 && rowHref}
              <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the rowHref callback is caller-supplied and is expected to wrap with resolve() at the call site -->
              <a href={rowHref(row)} class="underline">{cellValue(row, col)}</a>
            {:else}
              {cellValue(row, col)}
            {/if}
          </td>
        {/each}
      </tr>
    {/each}
  </tbody>
</table>

{#if rows.length === 0}
  <p class="text-muted-foreground p-4">
    No matching rows. Adjust the query or filters to see results.
  </p>
{/if}
