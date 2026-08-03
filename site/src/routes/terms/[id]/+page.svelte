<script lang="ts">
  import BackLink from "$lib/components/navigation/BackLink.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const termDescription = $derived(
    `The glossary entry for “${data.term.label}” explains a term used in Ardenfall item descriptions.`,
  );
</script>

<svelte:head>
  <title>{data.term.label} | Glossary | Ardenfall Compendium</title>
  <meta name="description" content={termDescription} />
  <link rel="canonical" href={data.term.routePath} />
  <meta property="og:title" content={`${data.term.label} | Glossary | Ardenfall Compendium`} />
  <meta property="og:description" content={termDescription} />
  <meta property="og:url" content={data.term.routePath} />
  <meta property="og:type" content="article" />
</svelte:head>

<BackLink href={data.itemRoute} label="items" />
<h1 class="mt-2 text-2xl font-bold">{data.term.label}</h1>
<p class="text-muted-foreground mt-2">Generated glossary term from Ardenfall tooltip metadata.</p>
