<script lang="ts">
  import CharacterDetail from "$lib/components/characters/CharacterDetail.svelte";
  import RelationshipSection from "$lib/components/relationships/RelationshipSection.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const character = $derived(data.presentation);
</script>

<svelte:head>
  <title>{character.displayName} | Characters | Ardenfall Compendium</title>
  <meta name="description" content={`${character.displayName} in the Ardenfall Compendium.`} />
  <link rel="canonical" href={character.routePath} />
  <meta
    property="og:title"
    content={`${character.displayName} | Characters | Ardenfall Compendium`}
  />
  <meta
    property="og:description"
    content={`${character.displayName} in the Ardenfall Compendium.`}
  />
  <meta property="og:url" content={character.routePath} />
  <meta property="og:type" content="article" />
</svelte:head>

<a class="text-sm underline" href={data.characterRoute}>← back to characters</a>
<h1 class="mt-2 text-2xl font-bold">{character.displayName}</h1>

<CharacterDetail presentation={character} />

<div class="mt-6 grid gap-6">
  {#each data.relationships as section (section.id)}
    <RelationshipSection {section} />
  {/each}
</div>
