<script lang="ts">
  import "../app.css";
  import { resolve } from "$app/paths";
  let { children } = $props();
</script>

<header class="bg-background border-border border-b">
  <div class="container mx-auto flex items-center justify-between p-4">
    <a href={resolve("/")} class="text-lg font-semibold">Ardenfall Compendium</a>
    <nav class="text-muted-foreground flex gap-4">
      <a href={resolve("/items")} class="hover:text-foreground">Items</a>
    </nav>
  </div>
</header>

<main class="container mx-auto p-4">
  {@render children()}
</main>
