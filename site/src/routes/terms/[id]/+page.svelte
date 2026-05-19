<script lang="ts">
  import { resolve } from "$app/paths";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>{data.term.label} | Glossary | Ardenfall Compendium</title>
</svelte:head>

<a class="text-sm underline" href={resolve("/items")}>← back to items</a>
<h1 class="mt-2 text-2xl font-bold">{data.term.label}</h1>
<p class="text-muted-foreground mt-2">Generated glossary term from Ardenfall tooltip metadata.</p>
