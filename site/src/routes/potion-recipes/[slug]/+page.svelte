<script lang="ts">
  import BackLink from "$lib/components/navigation/BackLink.svelte";
  import EntityDetailHeader from "$lib/components/EntityDetailHeader.svelte";
  import PotionRecipeDetail from "$lib/components/potion-recipes/PotionRecipeDetail.svelte";
  import RelationshipSection from "$lib/components/relationships/RelationshipSection.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const recipe = $derived(data.presentation);
</script>

<svelte:head>
  <title>{recipe.name} | Potion Recipes | Ardenfall Compendium</title>
  <meta name="description" content={`${recipe.name} potion recipe in the Ardenfall Compendium.`} />
  <link rel="canonical" href={recipe.routePath} />
  <meta property="og:title" content={`${recipe.name} | Potion Recipes | Ardenfall Compendium`} />
  <meta
    property="og:description"
    content={`${recipe.name} potion recipe in the Ardenfall Compendium.`}
  />
  <meta property="og:url" content={recipe.routePath} />
  <meta property="og:type" content="article" />
</svelte:head>

<BackLink href={data.potionRecipeRoute} label="potion recipes" />
<EntityDetailHeader title={recipe.name} iconSrc={null} />
<PotionRecipeDetail {recipe} />
<div class="mt-6 grid gap-6">
  {#each data.relationships as section (section.id)}
    <RelationshipSection {section} />
  {/each}
</div>
