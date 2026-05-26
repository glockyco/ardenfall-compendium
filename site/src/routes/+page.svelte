<script lang="ts">
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Ardenfall Compendium</title>
</svelte:head>

<h1 class="text-2xl font-bold">Ardenfall Compendium</h1>
<p class="text-muted-foreground mt-2">
  Static compendium of Ardenfall game data. Currently focused on items.
</p>
<a class="mt-4 inline-block underline" href={data.itemRoute}>Browse items →</a>
