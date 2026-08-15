<script lang="ts">
  import CharacterTypeOverview from "$lib/components/character-types/CharacterTypeOverview.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Character types | Ardenfall Compendium</title>
  <meta
    name="description"
    content={`Browse ${data.characterTypes.length} character types in the Ardenfall Compendium.`}
  />
  <link rel="canonical" href={data.characterTypeRoute} />
  <meta property="og:title" content="Character types | Ardenfall Compendium" />
  <meta
    property="og:description"
    content={`Browse ${data.characterTypes.length} character types in the Ardenfall Compendium.`}
  />
  <meta property="og:url" content={data.characterTypeRoute} />
  <meta property="og:type" content="website" />
</svelte:head>

<h1 class="text-2xl font-bold">Character types</h1>
<p class="text-muted-foreground mt-2">
  {data.characterTypes.length} character types in the game data.
</p>
<CharacterTypeOverview rows={data.characterTypes} />
