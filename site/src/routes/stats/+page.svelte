<script lang="ts">
  import StatTypeOverview from "$lib/components/stats/StatTypeOverview.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Stats | Ardenfall Compendium</title>
  <meta
    name="description"
    content={`Browse ${data.stats.length} deterministic stats in the Ardenfall Compendium.`}
  />
  <link rel="canonical" href={data.statTypeRoute} />
  <meta property="og:title" content="Stats | Ardenfall Compendium" />
  <meta
    property="og:description"
    content={`Browse ${data.stats.length} deterministic stats in the Ardenfall Compendium.`}
  />
  <meta property="og:url" content={data.statTypeRoute} />
  <meta property="og:type" content="website" />
</svelte:head>

<h1 class="text-2xl font-bold">Stats</h1>
<p class="text-muted-foreground mt-2">{data.stats.length} deterministic stat records.</p>
<StatTypeOverview rows={data.stats} />
