<script lang="ts">
  import PlacedCharacterOverview from "$lib/components/placed-characters/PlacedCharacterOverview.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Placed Characters | Ardenfall Compendium</title>
  <meta
    name="description"
    content={`Browse ${data.placedCharacters.length} placed characters in the Ardenfall Compendium.`}
  />
  <link rel="canonical" href={data.placedCharacterRoute} />
  <meta property="og:title" content="Placed Characters | Ardenfall Compendium" />
  <meta
    property="og:description"
    content={`Browse ${data.placedCharacters.length} placed characters in the Ardenfall Compendium.`}
  />
  <meta property="og:url" content={data.placedCharacterRoute} />
  <meta property="og:type" content="website" />
</svelte:head>

<h1 class="text-2xl font-bold">Placed Characters</h1>
<p class="text-muted-foreground mt-2">
  {data.placedCharacters.length} placed characters in the game data.
</p>

<PlacedCharacterOverview rows={data.placedCharacters} />
