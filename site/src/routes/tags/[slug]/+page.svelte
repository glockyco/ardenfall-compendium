<script lang="ts">
  import BackLink from "$lib/components/navigation/BackLink.svelte";
  import ItemTagDetail from "$lib/components/tags/ItemTagDetail.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const tag = $derived(data.presentation);
</script>

<svelte:head>
  <title>{tag.name} | Tags | Ardenfall Compendium</title>
  <meta
    name="description"
    content={tag.description ||
      `Item tag ${tag.name} with ${tag.itemCount} items in the Ardenfall Compendium.`}
  />
  <link rel="canonical" href={tag.routePath} />
  <meta property="og:title" content={`${tag.name} | Tags | Ardenfall Compendium`} />
  <meta
    property="og:description"
    content={tag.description ||
      `Item tag ${tag.name} with ${tag.itemCount} items in the Ardenfall Compendium.`}
  />
  <meta property="og:url" content={tag.routePath} />
  <meta property="og:type" content="article" />
</svelte:head>

<BackLink href={data.itemTagRoute} label="tags" />
<h1 class="mt-2 text-2xl font-bold">{tag.name}</h1>
<ItemTagDetail presentation={tag} items={data.items} columns={data.columns} />
