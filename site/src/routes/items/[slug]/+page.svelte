<script lang="ts">
  import BackLink from "$lib/components/navigation/BackLink.svelte";
  import ItemHeader from "$lib/components/items/ItemHeader.svelte";
  import ItemPresentationPanel from "$lib/components/items/ItemPresentationPanel.svelte";
  import RelationshipSection from "$lib/components/relationships/RelationshipSection.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const item = $derived(data.presentation);
  const itemDescription = $derived(
    `${item.name} is listed in the Ardenfall Compendium under the ${item.itemType?.toLowerCase() ?? "item"} category.`,
  );
  const itemRoutePath = $derived(item.routePath);
</script>

<svelte:head>
  <title>{item.name} | Ardenfall Compendium</title>
  <meta name="description" content={itemDescription} />
  <link rel="canonical" href={itemRoutePath} />
  <meta property="og:title" content={`${item.name} | Ardenfall Compendium`} />
  <meta property="og:description" content={itemDescription} />
  <meta property="og:url" content={itemRoutePath} />
  <meta property="og:type" content="article" />
</svelte:head>

<BackLink href={data.itemRoute} label="items" />
<div class="mt-2">
  <ItemHeader {item} />
</div>

<div class="mt-6 grid gap-6">
  <ItemPresentationPanel {item} />
  {#each data.relationships as section (section.id)}
    <RelationshipSection {section} />
  {/each}
</div>
