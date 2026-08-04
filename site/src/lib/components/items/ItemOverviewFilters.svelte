<script lang="ts">
  import { browser } from "$app/environment";
  import EntityTable from "$lib/components/EntityTable.svelte";
  import type { ItemOverviewFilter, ItemOverviewRow } from "$lib/server/read-models";

  type Column = {
    id: string;
    label: string;
    field: keyof ItemOverviewRow & string;
    renderer?: "text" | "itemNameWithIcon";
    sortable: boolean;
  };

  let {
    rows,
    columns,
    filters,
  }: {
    rows: ItemOverviewRow[];
    columns: Column[];
    filters: ItemOverviewFilter[];
  } = $props();

  let query = $state("");
  let variant = $state("all");
  let page = $state(1);
  const pageSize = 100;

  if (browser) {
    const params = new URLSearchParams(window.location.search);
    query = params.get("q") ?? "";
    variant = params.get("variant") ?? "all";
  }

  const filteredRows = $derived(
    rows.filter((row) => {
      const matchesVariant = variant === "all" || row.variant === variant;
      const term = query.trim().toLowerCase();
      const matchesQuery = term.length === 0 || (row.name ?? row.id).toLowerCase().includes(term);
      return matchesVariant && matchesQuery;
    }),
  );

  const tableRows = $derived(filteredRows);

  const pageCount = $derived(Math.max(1, Math.ceil(tableRows.length / pageSize)));
  const visibleRows = $derived(tableRows.slice((page - 1) * pageSize, page * pageSize));

  function updateQuery() {
    page = 1;
    syncUrl();
  }

  function updateVariant() {
    page = 1;
    syncUrl();
  }

  function syncUrl() {
    if (!browser) return;
    const url = new URL(window.location.href);
    if (query.trim()) url.searchParams.set("q", query.trim());
    else url.searchParams.delete("q");
    if (variant !== "all") url.searchParams.set("variant", variant);
    else url.searchParams.delete("variant");
    history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }
</script>

<div class="grid gap-4">
  <div
    class="border-border bg-card grid gap-3 rounded-lg border p-4 sm:grid-cols-[minmax(12rem,1fr)_minmax(12rem,16rem)]"
  >
    <label class="grid gap-1 text-sm">
      <span class="text-muted-foreground">Search</span>
      <input
        class="border-input-border bg-background rounded-md border px-3 py-2 text-base"
        bind:value={query}
        oninput={updateQuery}
        placeholder="Filter items"
      />
    </label>
    <label class="grid gap-1 text-sm">
      <span class="text-muted-foreground">Variant</span>
      <select
        class="border-input-border bg-background rounded-md border px-3 py-2"
        bind:value={variant}
        onchange={updateVariant}
      >
        <option value="all">All variants</option>
        {#each filters.find((filter) => filter.id === "variant")?.options ?? [] as option (option.value)}
          <option value={option.value}>{option.label} ({option.count})</option>
        {/each}
      </select>
    </label>
  </div>

  <p class="text-muted-foreground text-sm">
    {filteredRows.length} matching items of {rows.length} total
  </p>
  {#if filteredRows.length === 0}
    <p class="border-border bg-muted/30 text-muted-foreground rounded-lg border p-4 text-sm">
      No items match “{query.trim() || "the selected variant"}”. Clear the search or choose All
      variants to see results.
    </p>
  {:else}
    <EntityTable {columns} rows={visibleRows} rowHref={(row) => row.routePath} />
    {#if pageCount > 1}
      <nav aria-label="Item table pages" class="flex items-center justify-between gap-3 text-sm">
        <button
          class="border-input-border rounded-md border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          onclick={() => (page = Math.max(1, page - 1))}
          disabled={page === 1}>Previous</button
        >
        <span class="text-muted-foreground">Page {page} of {pageCount}</span>
        <button
          class="border-input-border rounded-md border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          onclick={() => (page = Math.min(pageCount, page + 1))}
          disabled={page === pageCount}>Next</button
        >
      </nav>
    {/if}
  {/if}
</div>
