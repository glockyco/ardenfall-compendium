<script lang="ts">
  import BackLink from "$lib/components/navigation/BackLink.svelte";
  import CharacterTypeDetail from "$lib/components/character-types/CharacterTypeDetail.svelte";
  import RelationshipSection from "$lib/components/relationships/RelationshipSection.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const character = $derived(data.presentation);

  const pageName = $derived(character.name);
</script>

<svelte:head>
  <title>{pageName} | Character types | Ardenfall Compendium</title>
  <meta name="description" content={`${pageName} in the Ardenfall Compendium.`} />
  <link rel="canonical" href={character.routePath} />
  <meta property="og:title" content={`${pageName} | Character types | Ardenfall Compendium`} />
  <meta property="og:description" content={`${pageName} in the Ardenfall Compendium.`} />
  <meta property="og:url" content={character.routePath} />
  <meta property="og:type" content="article" />
</svelte:head>

<BackLink href={data.characterTypeRoute} label="character types" />
<div class="mt-2 flex items-center gap-2">
  <h1 class="text-2xl font-bold">{pageName}</h1>
  {#if character.nameIsDescription}
    <span class="text-muted-foreground text-base">Description</span>
  {/if}
</div>

<CharacterTypeDetail presentation={character} />

<div class="mt-6 grid gap-6">
  {#each data.relationships as section (section.id)}
    <RelationshipSection {section} />
  {/each}
</div>
