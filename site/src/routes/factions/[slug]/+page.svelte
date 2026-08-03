<script lang="ts">
  import BackLink from "$lib/components/navigation/BackLink.svelte";
  import EntityDetailHeader from "$lib/components/EntityDetailHeader.svelte";
  import FactionDetail from "$lib/components/factions/FactionDetail.svelte";
  import RelationshipSection from "$lib/components/relationships/RelationshipSection.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const faction = $derived(data.presentation);
</script>

<svelte:head>
  <title>{faction.displayName} | Factions | Ardenfall Compendium</title>
  <meta
    name="description"
    content={faction.description || `${faction.displayName} in the Ardenfall Compendium.`}
  />
  <link rel="canonical" href={faction.routePath} />
  <meta property="og:title" content={`${faction.displayName} | Factions | Ardenfall Compendium`} />
  <meta
    property="og:description"
    content={faction.description || `${faction.displayName} in the Ardenfall Compendium.`}
  />
  <meta property="og:url" content={faction.routePath} />
  <meta property="og:type" content="article" />
</svelte:head>

<BackLink href={data.factionRoute} label="factions" />
<EntityDetailHeader title={faction.displayName} iconSrc={faction.displayIconSrc} />

<div class="mt-4 grid gap-6">
  <FactionDetail presentation={faction} />

  {#each data.relationships as section (section.id)}
    <RelationshipSection {section} />
  {/each}
</div>
