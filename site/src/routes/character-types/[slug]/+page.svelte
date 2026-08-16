<script lang="ts">
  import BackLink from "$lib/components/navigation/BackLink.svelte";
  import CharacterTypeDetail from "$lib/components/character-types/CharacterTypeDetail.svelte";
  import RelationshipSection from "$lib/components/relationships/RelationshipSection.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const character = $derived(data.presentation);
  const titleLabel = $derived(
    character.nameIsDescription ? `Description: ${character.displayName}` : character.displayName,
  );
</script>

<svelte:head>
  <title>{titleLabel} | Character types | Ardenfall Compendium</title>
  <meta name="description" content={`${titleLabel} in the Ardenfall Compendium.`} />
  <link rel="canonical" href={character.routePath} />
  <meta property="og:title" content={`${titleLabel} | Character types | Ardenfall Compendium`} />
  <meta property="og:description" content={`${titleLabel} in the Ardenfall Compendium.`} />
  <meta property="og:url" content={character.routePath} />
  <meta property="og:type" content="article" />
</svelte:head>

<BackLink href={data.characterTypeRoute} label="character types" />
<h1 class="mt-2 text-2xl font-bold">
  {#if character.nameIsDescription}<span class="text-muted-foreground text-base"
      >Description:
    </span>{/if}
  {character.displayName}
</h1>

<CharacterTypeDetail presentation={character} />

<div class="mt-6 grid gap-6">
  {#each data.relationships as section (section.id)}
    <RelationshipSection {section} />
  {/each}
</div>
