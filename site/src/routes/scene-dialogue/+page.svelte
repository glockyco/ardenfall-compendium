<script lang="ts">
  import SceneDialogueOverview from "$lib/components/scene-dialogue/SceneDialogueOverview.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Scene Dialogue | Ardenfall Compendium</title>
  <meta
    name="description"
    content={`Browse ${data.sceneDialogue.length} speakers the game places in the world.`}
  />
  <link rel="canonical" href={data.sceneDialogueRoute} />
  <meta property="og:title" content="Scene Dialogue | Ardenfall Compendium" />
  <meta
    property="og:description"
    content={`Browse ${data.sceneDialogue.length} speakers the game places in the world.`}
  />
  <meta property="og:url" content={data.sceneDialogueRoute} />
  <meta property="og:type" content="website" />
</svelte:head>

<h1 class="text-2xl font-bold">Scene Dialogue</h1>
<p class="text-muted-foreground mt-2">
  {data.sceneDialogue.length} speakers the scenes place, with the lines they own. This is the dialogue
  that hangs off no quest.
</p>

<SceneDialogueOverview rows={data.sceneDialogue} />
