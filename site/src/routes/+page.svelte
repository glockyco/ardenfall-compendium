<script lang="ts">
  import { resolve } from "$app/paths";
</script>

<svelte:head>
  <title>Ardenfall Archives</title>
</svelte:head>

<h1 class="text-2xl font-bold">Ardenfall Archives</h1>
<p class="text-muted-foreground mt-2">
  Static archive of Ardenfall game data. Slice 1 ships items only.
</p>
<a class="mt-4 inline-block underline" href={resolve("/items")}>Browse items →</a>
