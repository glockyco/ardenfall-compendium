<script lang="ts">
  import CharacterOverview from "$lib/components/characters/CharacterOverview.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Characters | Ardenfall Compendium</title>
  <meta
    name="description"
    content={`Browse ${data.characters.length} characters in the Ardenfall Compendium.`}
  />
  <link rel="canonical" href={data.characterRoute} />
  <meta property="og:title" content="Characters | Ardenfall Compendium" />
  <meta
    property="og:description"
    content={`Browse ${data.characters.length} characters in the Ardenfall Compendium.`}
  />
  <meta property="og:url" content={data.characterRoute} />
  <meta property="og:type" content="website" />
</svelte:head>

<h1 class="text-2xl font-bold">Characters</h1>
<p class="text-muted-foreground mt-2">
  {data.characters.length} characters in the game data. Labels marked Description describe characters
  the game names at runtime rather than naming them.
</p>

<CharacterOverview rows={data.characters} />
