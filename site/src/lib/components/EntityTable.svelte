<script lang="ts" generics="T extends { id: string | number }">
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
  let sortField = $state<(keyof T & string) | null>(null);
  let sortDir = $state<"asc" | "desc">("asc");

  const sortedRows = $derived.by(() => {
    if (!sortField) return rows;
    const field = sortField;
    return [...rows].sort((a, b) => {
      const av = a[field];
      const bv = b[field];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  });

  function toggleSort(col: Column) {
    if (col.sortable === false) return;
    const field = col.field;
    if (sortField === field) {
      sortDir = sortDir === "asc" ? "desc" : "asc";
    } else {
      sortField = field;
      sortDir = "asc";
    }
  }

  function ariaSort(col: Column): "ascending" | "descending" | "none" {
    if (col.sortable === false || sortField !== col.field) return "none";
    return sortDir === "asc" ? "ascending" : "descending";
  }

  function iconSrc(row: T): string | null {
    const value = (row as T & { displayIconSrc?: unknown }).displayIconSrc;
    return typeof value === "string" && value.length > 0 ? value : null;
  }
</script>

<table class="w-full text-left text-sm">
  <thead class="bg-muted text-muted-foreground">
    <tr>
      {#each columns as col (col.id)}
        <th
          scope="col"
          aria-sort={ariaSort(col)}
          class={col.sortable === false
            ? "p-2 select-none"
            : "hover:bg-secondary cursor-pointer p-2 select-none"}
          onclick={() => toggleSort(col)}
        >
          {col.label}
          {#if sortField === col.field && col.sortable !== false}
            <span aria-hidden="true">{sortDir === "asc" ? "▲" : "▼"}</span>
          {/if}
        </th>
      {/each}
    </tr>
  </thead>
  <tbody>
    {#each sortedRows as row (row.id)}
      <tr class="border-border hover:bg-muted/40 border-b">
        {#each columns as col, i (col.id)}
          <td class="p-2">
            {#if col.renderer === "itemNameWithIcon"}
              <span class="flex items-center gap-2">
                <span
                  class="bg-muted border-border flex size-8 shrink-0 items-center justify-center rounded border"
                  aria-hidden="true"
                >
                  {#if iconSrc(row)}
                    <img
                      class="size-6 object-contain"
                      src={iconSrc(row)!}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  {/if}
                </span>
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
