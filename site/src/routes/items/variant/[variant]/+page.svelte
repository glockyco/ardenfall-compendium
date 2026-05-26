<script lang="ts">
  import EntityTable from "$lib/components/EntityTable.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>{data.category.label} | {data.label} | Ardenfall Compendium</title>
</svelte:head>

<a class="text-sm underline" href={data.itemRoute}>← back to items</a>
<h1 class="mt-2 text-2xl font-bold">{data.category.label}</h1>
<p class="text-muted-foreground mt-2">{data.rows.length} items</p>
<div class="mt-4">
  <EntityTable rows={data.rows} columns={data.columns} rowHref={(row) => row.routePath} />
</div>
