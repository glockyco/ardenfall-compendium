<script lang="ts">
  import Search from "$lib/components/search/Search.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Search · Ardenfall Compendium</title>
  <meta name="description" content="Search pages in the Ardenfall Compendium." />
</svelte:head>

<Search sections={data.sections} />
