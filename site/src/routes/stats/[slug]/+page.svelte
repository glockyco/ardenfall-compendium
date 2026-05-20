<script lang="ts">
  import { resolve } from "$app/paths";
  import StatTypeDetail from "$lib/components/stats/StatTypeDetail.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const stat = $derived(data.presentation);
</script>

<svelte:head>
  <title>{stat.name} | Stats | Ardenfall Compendium</title>
</svelte:head>

<a class="text-sm underline" href={resolve("/stats")}>← back to stats</a>
<h1 class="mt-2 text-2xl font-bold">{stat.name}</h1>
<StatTypeDetail presentation={stat} />
