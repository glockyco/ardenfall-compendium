<script lang="ts">
  import BackLink from "$lib/components/navigation/BackLink.svelte";
  import RelationshipSection from "$lib/components/relationships/RelationshipSection.svelte";
  import SceneDialogueDetail from "$lib/components/scene-dialogue/SceneDialogueDetail.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const speaker = $derived(data.presentation);
</script>

<svelte:head>
  <title>{speaker.name} | Scene Dialogue | Ardenfall Compendium</title>
  <meta name="description" content={`${speaker.name} in the Ardenfall Compendium.`} />
  <link rel="canonical" href={speaker.routePath} />
  <meta property="og:title" content={`${speaker.name} | Scene Dialogue | Ardenfall Compendium`} />
  <meta property="og:description" content={`${speaker.name} in the Ardenfall Compendium.`} />
  <meta property="og:url" content={speaker.routePath} />
  <meta property="og:type" content="article" />
</svelte:head>

<BackLink href={data.sceneDialogueRoute} label="scene dialogue" />
<h1 class="mt-2 text-2xl font-bold">{speaker.name}</h1>

<SceneDialogueDetail presentation={speaker} />

<div class="mt-6 grid gap-6">
  {#each data.relationships as section (section.id)}
    <RelationshipSection {section} />
  {/each}
</div>
