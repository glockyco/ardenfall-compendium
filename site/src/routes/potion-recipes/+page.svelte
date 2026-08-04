<script lang="ts">
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Potion Recipes | Ardenfall Compendium</title>
  <meta
    name="description"
    content={`Browse ${data.recipes.length} potion recipes in the Ardenfall Compendium.`}
  />
  <link rel="canonical" href={data.potionRecipeRoute} />
  <meta property="og:title" content="Potion Recipes | Ardenfall Compendium" />
  <meta
    property="og:description"
    content={`Browse ${data.recipes.length} potion recipes in the Ardenfall Compendium.`}
  />
  <meta property="og:url" content={data.potionRecipeRoute} />
  <meta property="og:type" content="website" />
</svelte:head>

<h1 class="text-2xl font-bold">Potion Recipes</h1>
<p class="text-muted-foreground mt-2">{data.recipes.length} potion recipes.</p>

{#if data.recipes.length > 0}
  <ul class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {#each data.recipes as recipe (recipe.id)}
      <li class="border-border bg-card rounded-lg border p-4">
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- route paths come from the static read model -->
        <a class="block underline-offset-4 hover:underline" href={recipe.routePath}>
          <span class="block font-medium">{recipe.name}</span>
        </a>
      </li>
    {/each}
  </ul>
{:else}
  <p class="text-muted-foreground mt-4">No potion recipes found.</p>
{/if}
