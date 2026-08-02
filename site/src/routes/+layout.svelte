<script lang="ts">
  import "../app.css";
  import { resolve } from "$app/paths";
  import type { LayoutProps } from "./$types";

  let { children, data }: LayoutProps = $props();
</script>

<header class="bg-background border-border border-b">
  <div class="container mx-auto flex items-center justify-between p-4">
    <a href={resolve("/")} class="text-lg font-semibold">Ardenfall Compendium</a>
    <!-- Every public section belongs here. The layout already resolved these routes
         and the nav rendered only two of them, which left whole prerendered sections
         with no path to reach them from the site. -->
    <nav class="text-muted-foreground flex flex-wrap gap-4">
      <a href={data.itemRoute} class="hover:text-foreground">Items</a>
      <a href={data.spellRoute} class="hover:text-foreground">Spells</a>
      <a href={data.statTypeRoute} class="hover:text-foreground">Stats</a>
      <a href={data.itemCategoryRoute} class="hover:text-foreground">Categories</a>
      <a href={data.itemTagRoute} class="hover:text-foreground">Tags</a>
      <a href={data.mapRoute} class="hover:text-foreground">Map</a>
    </nav>
  </div>
</header>

<main class="container mx-auto p-4">
  {@render children()}
</main>
