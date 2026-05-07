<script lang="ts">
  import { resolve } from "$app/paths";
  import EntityTable from "$lib/components/EntityTable.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>{data.label} | Ardenfall Compendium</title>
</svelte:head>

<h1 class="text-2xl font-bold">{data.label}</h1>
<p class="text-muted-foreground mt-2">{data.rows.length} {data.label.toLowerCase()}</p>
<div class="mt-4">
  <EntityTable
    rows={data.rows}
    columns={data.columns}
    rowHref={(r) => resolve("/items/[id]", { id: r.id })}
  />
</div>
