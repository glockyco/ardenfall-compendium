<script lang="ts">
  import ItemOverviewFilters from "$lib/components/items/ItemOverviewFilters.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>{data.label} | Ardenfall Compendium</title>
</svelte:head>

<h1 class="text-2xl font-bold">{data.label}</h1>
<div class="mt-4">
  <ItemOverviewFilters rows={data.rows} columns={data.columns} filters={data.filters} />
</div>
