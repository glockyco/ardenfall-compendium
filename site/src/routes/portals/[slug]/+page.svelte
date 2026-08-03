<script lang="ts">
  import BackLink from "$lib/components/navigation/BackLink.svelte";
  import PortalDetail from "$lib/components/portals/PortalDetail.svelte";
  import RelationshipSection from "$lib/components/relationships/RelationshipSection.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const portal = $derived(data.presentation);
</script>

<svelte:head>
  <title>{portal.name} | Portals | Ardenfall Compendium</title>
  <meta name="description" content={`${portal.name} in the Ardenfall Compendium.`} />
  <link rel="canonical" href={portal.routePath} />
  <meta property="og:title" content={`${portal.name} | Portals | Ardenfall Compendium`} />
  <meta property="og:description" content={`${portal.name} in the Ardenfall Compendium.`} />
  <meta property="og:url" content={portal.routePath} />
  <meta property="og:type" content="article" />
</svelte:head>

<BackLink href={data.portalRoute} label="portals" />
<h1 class="mt-2 text-2xl font-bold">{portal.name}</h1>

<PortalDetail presentation={portal} />

<div class="mt-6 grid gap-6">
  {#each data.relationships as section (section.id)}
    <RelationshipSection {section} />
  {/each}
</div>
