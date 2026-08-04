<script lang="ts">
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Enchantments | Ardenfall Compendium</title>
  <meta
    name="description"
    content={`Browse ${data.enchantments.length} enchantments in the Ardenfall Compendium.`}
  />
  <link rel="canonical" href={data.enchantmentRoute} />
  <meta property="og:title" content="Enchantments | Ardenfall Compendium" />
  <meta
    property="og:description"
    content={`Browse ${data.enchantments.length} enchantments in the Ardenfall Compendium.`}
  />
  <meta property="og:url" content={data.enchantmentRoute} />
  <meta property="og:type" content="website" />
</svelte:head>

<h1 class="text-2xl font-bold">Enchantments</h1>
<p class="text-muted-foreground mt-2">{data.enchantments.length} enchantments.</p>

{#if data.enchantments.length > 0}
  <ul class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {#each data.enchantments as enchantment (enchantment.id)}
      <li class="border-border bg-card rounded-lg border p-4">
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- route paths come from the static read model -->
        <a class="block underline-offset-4 hover:underline" href={enchantment.routePath}>
          <span class="block font-medium">{enchantment.name}</span>
        </a>
      </li>
    {/each}
  </ul>
{:else}
  <p class="text-muted-foreground mt-4">No enchantments found.</p>
{/if}
