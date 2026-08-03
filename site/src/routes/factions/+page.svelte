<script lang="ts">
  import FactionOverview from "$lib/components/factions/FactionOverview.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Factions | Ardenfall Compendium</title>
  <meta
    name="description"
    content={`Browse ${data.factions.length} factions in the Ardenfall Compendium.`}
  />
  <link rel="canonical" href={data.factionRoute} />
  <meta property="og:title" content="Factions | Ardenfall Compendium" />
  <meta
    property="og:description"
    content={`Browse ${data.factions.length} factions in the Ardenfall Compendium.`}
  />
  <meta property="og:url" content={data.factionRoute} />
  <meta property="og:type" content="website" />
</svelte:head>

<h1 class="text-2xl font-bold">Factions</h1>
<p class="text-muted-foreground mt-2">{data.factions.length} factions in the game data.</p>

<FactionOverview rows={data.factions} />
