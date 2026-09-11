<script lang="ts">
  import ContainerOverview from "$lib/components/containers/ContainerOverview.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Containers | Ardenfall Compendium</title>
  <meta
    name="description"
    content={`Browse ${data.containers.length} containers in the Ardenfall Compendium.`}
  />
  <link rel="canonical" href={data.containerRoute} />
  <meta property="og:title" content="Containers | Ardenfall Compendium" />
  <meta
    property="og:description"
    content={`Browse ${data.containers.length} containers in the Ardenfall Compendium.`}
  />
  <meta property="og:url" content={data.containerRoute} />
  <meta property="og:type" content="website" />
</svelte:head>

<h1 class="text-2xl font-bold">Containers</h1>
<p class="text-muted-foreground mt-2">
  {data.containers.length} containers stand in the world, with the loot their lists can yield.
</p>

<ContainerOverview rows={data.containers} />
