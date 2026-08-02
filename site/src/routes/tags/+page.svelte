<script lang="ts">
  import ItemTagOverview from "$lib/components/tags/ItemTagOverview.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Tags | Ardenfall Compendium</title>
  <meta
    name="description"
    content={`Browse ${data.tags.length} item tags in the Ardenfall Compendium.`}
  />
  <link rel="canonical" href={data.itemTagRoute} />
  <meta property="og:title" content="Tags | Ardenfall Compendium" />
  <meta
    property="og:description"
    content={`Browse ${data.tags.length} item tags in the Ardenfall Compendium.`}
  />
  <meta property="og:url" content={data.itemTagRoute} />
  <meta property="og:type" content="website" />
</svelte:head>

<h1 class="text-2xl font-bold">Tags</h1>
<p class="text-muted-foreground mt-2">Item tags and their in-game tooltip text.</p>
<ItemTagOverview rows={data.tags} />
