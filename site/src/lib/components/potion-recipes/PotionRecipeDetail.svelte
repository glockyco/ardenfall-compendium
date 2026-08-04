<script lang="ts">
  import type { PotionRecipePresentationRow } from "$lib/server/entities/potion-recipe";

  let { recipe }: { recipe: PotionRecipePresentationRow } = $props();
</script>

<div class="mt-4 grid gap-6">
  <section class="border-border bg-card rounded-lg border p-5">
    <h2 class="font-semibold">Produces</h2>
    {#if recipe.producedRefs.length === 0}
      <p class="text-muted-foreground mt-3 text-sm">This recipe has no recorded products.</p>
    {:else}
      <ul class="mt-3 grid gap-2 sm:grid-cols-2">
        {#each recipe.producedRefs as product (`${product.itemId}-${product.form}`)}
          <li>
            {#if product.itemRoutePath}
              <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- route paths come from the static read model -->
              <a class="underline underline-offset-2" href={product.itemRoutePath}
                >{product.itemLabel}</a
              >
            {:else}
              <span>{product.itemLabel}</span>
            {/if}
            <span class="text-muted-foreground text-sm"> ({product.form} potion)</span>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="border-border bg-card rounded-lg border p-5">
    <h2 class="font-semibold">Ingredients</h2>
    {#if recipe.ingredients.length === 0}
      <p class="text-muted-foreground mt-3 text-sm">This recipe has no ingredients.</p>
    {:else}
      <ul class="mt-3 grid gap-2 sm:grid-cols-2">
        {#each recipe.ingredients as ingredient (`${ingredient.tagId}-${ingredient.count}`)}
          <li>
            <span class="font-medium">{ingredient.count}×</span>
            {#if ingredient.tagRoutePath}
              <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- route paths come from the static read model -->
              <a class="ml-1 underline underline-offset-2" href={ingredient.tagRoutePath}
                >{ingredient.tagLabel}</a
              >
            {:else}
              <span class="ml-1">{ingredient.tagLabel}</span>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  {#if recipe.skillRequirement !== null}
    <section class="border-border bg-card rounded-lg border p-5">
      <h2 class="font-semibold">Skill requirement</h2>
      <p class="mt-2">{recipe.skillRequirement}</p>
    </section>
  {/if}
</div>
