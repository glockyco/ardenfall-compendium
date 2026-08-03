<script lang="ts">
  import BackLink from "$lib/components/navigation/BackLink.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>{data.term.label} | Glossary | Ardenfall Compendium</title>
</svelte:head>

<BackLink href={data.itemRoute} label="items" />
<h1 class="mt-2 text-2xl font-bold">{data.term.label}</h1>
<p class="text-muted-foreground mt-2">Generated glossary term from Ardenfall tooltip metadata.</p>
