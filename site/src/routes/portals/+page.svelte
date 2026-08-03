<script lang="ts">
  import PortalOverview from "$lib/components/portals/PortalOverview.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Portals | Ardenfall Compendium</title>
  <meta
    name="description"
    content={`Browse ${data.portals.length} portals in the Ardenfall Compendium.`}
  />
  <link rel="canonical" href={data.portalRoute} />
  <meta property="og:title" content="Portals | Ardenfall Compendium" />
  <meta
    property="og:description"
    content={`Browse ${data.portals.length} portals in the Ardenfall Compendium.`}
  />
  <meta property="og:url" content={data.portalRoute} />
  <meta property="og:type" content="website" />
</svelte:head>

<h1 class="text-2xl font-bold">Portals</h1>
<p class="text-muted-foreground mt-2">{data.portals.length} portals in the game data.</p>

<PortalOverview rows={data.portals} />
