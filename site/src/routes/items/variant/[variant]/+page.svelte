<script lang="ts">
  import BackLink from "$lib/components/navigation/BackLink.svelte";
  import EntityTable from "$lib/components/EntityTable.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>{data.category.label} | {data.label} | Ardenfall Compendium</title>
</svelte:head>

<BackLink href={data.itemRoute} label="items" />
<h1 class="mt-2 text-2xl font-bold">{data.category.label}</h1>
<p class="text-muted-foreground mt-2">{data.rows.length} items</p>
<div class="mt-4">
  <EntityTable rows={data.rows} columns={data.columns} rowHref={(row) => row.routePath} />
</div>
