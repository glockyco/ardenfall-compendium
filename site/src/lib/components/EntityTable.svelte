<script lang="ts" generics="T extends { id: string | number }">
  import ItemIcon from "$lib/components/items/ItemIcon.svelte";
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
  <thead class="bg-muted text-muted-foreground">
    <tr>
      {#each columns as col (col.id)}
        <th scope="col" class="p-2">{col.label}</th>
      {/each}
    </tr>
  </thead>
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
                  <a href={rowHref(row)} class="underline">{row[col.field] ?? ""}</a>
                {:else}
                  <span>{row[col.field] ?? ""}</span>
                {/if}
              </span>
            {:else if i === 0 && rowHref}
              <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the rowHref callback is caller-supplied and is expected to wrap with resolve() at the call site -->
              <a href={rowHref(row)} class="underline">{row[col.field] ?? ""}</a>
            {:else}
              {row[col.field] ?? ""}
            {/if}
          </td>
        {/each}
      </tr>
    {/each}
  </tbody>
</table>

{#if rows.length === 0}
  <p class="text-muted-foreground p-4">No rows.</p>
{/if}
