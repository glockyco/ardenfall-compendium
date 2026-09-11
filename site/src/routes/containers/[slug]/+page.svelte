<script lang="ts">
  import ContainerDetail from "$lib/components/containers/ContainerDetail.svelte";
  import BackLink from "$lib/components/navigation/BackLink.svelte";
  import RelationshipSection from "$lib/components/relationships/RelationshipSection.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const container = $derived(data.presentation);
</script>

<svelte:head>
  <title>{container.name} | Containers | Ardenfall Compendium</title>
  <meta name="description" content={`${container.name} in the Ardenfall Compendium.`} />
  <link rel="canonical" href={container.routePath} />
  <meta property="og:title" content={`${container.name} | Containers | Ardenfall Compendium`} />
  <meta property="og:description" content={`${container.name} in the Ardenfall Compendium.`} />
  <meta property="og:url" content={container.routePath} />
  <meta property="og:type" content="article" />
</svelte:head>

<BackLink href={data.containerRoute} label="containers" />
<h1 class="mt-2 text-2xl font-bold">{container.name}</h1>

<ContainerDetail presentation={container} />

<div class="mt-6 grid gap-6">
  {#each data.relationships as section (section.id)}
    <RelationshipSection {section} />
  {/each}
</div>
