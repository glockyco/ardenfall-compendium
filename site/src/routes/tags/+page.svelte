<script lang="ts">
  import ItemTagOverview from "$lib/components/tags/ItemTagOverview.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Tags | Ardenfall Compendium</title>
</svelte:head>

<h1 class="text-2xl font-bold">Tags</h1>
<p class="text-muted-foreground mt-2">Item tags and their in-game tooltip text.</p>
<ItemTagOverview rows={data.tags} />
