<script lang="ts">
  import BackLink from "$lib/components/navigation/BackLink.svelte";
  import StatTypeDetail from "$lib/components/stats/StatTypeDetail.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const stat = $derived(data.presentation);
</script>

<svelte:head>
  <title>{stat.name} | Stats | Ardenfall Compendium</title>
  <meta
    name="description"
    content={stat.longDescription ??
      stat.description ??
      `${stat.name} stat in the Ardenfall Compendium.`}
  />
  <link rel="canonical" href={stat.routePath} />
  <meta property="og:title" content={`${stat.name} | Stats | Ardenfall Compendium`} />
  <meta
    property="og:description"
    content={stat.longDescription ??
      stat.description ??
      `${stat.name} stat in the Ardenfall Compendium.`}
  />
  <meta property="og:url" content={stat.routePath} />
  <meta property="og:type" content="article" />
</svelte:head>

<BackLink href={data.statTypeRoute} label="stats" />
<h1 class="mt-2 text-2xl font-bold">{stat.name}</h1>
<StatTypeDetail presentation={stat} />
