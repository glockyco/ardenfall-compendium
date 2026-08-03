<script lang="ts">
  import BackLink from "$lib/components/navigation/BackLink.svelte";
  import PlacedCharacterDetail from "$lib/components/placed-characters/PlacedCharacterDetail.svelte";
  import RelationshipSection from "$lib/components/relationships/RelationshipSection.svelte";
  import DialogueSection from "$lib/components/content/DialogueSection.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const character = $derived(data.presentation);
</script>

<svelte:head>
  <title>{character.name} | Placed Characters | Ardenfall Compendium</title>
  <meta name="description" content={`${character.name} in the Ardenfall Compendium.`} />
  <link rel="canonical" href={character.routePath} />
  <meta
    property="og:title"
    content={`${character.name} | Placed Characters | Ardenfall Compendium`}
  />
  <meta property="og:description" content={`${character.name} in the Ardenfall Compendium.`} />
  <meta property="og:url" content={character.routePath} />
  <meta property="og:type" content="article" />
</svelte:head>

<BackLink href={data.placedCharacterRoute} label="placed characters" />
<h1 class="mt-2 text-2xl font-bold">{character.name}</h1>

<PlacedCharacterDetail presentation={character} />
<DialogueSection groups={character.dialogue} heading="Dialogue" />

<div class="mt-6 grid gap-6">
  {#each data.relationships as section (section.id)}
    <RelationshipSection {section} />
  {/each}
</div>
