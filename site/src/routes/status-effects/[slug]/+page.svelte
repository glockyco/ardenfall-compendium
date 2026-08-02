<script lang="ts">
  import RichText from "$lib/components/content/RichText.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const statusEffect = $derived(data.presentation);
</script>

<svelte:head>
  <title>{statusEffect.displayName} | Status Effects | Ardenfall Compendium</title>
  <meta
    name="description"
    content={statusEffect.descriptionText ??
      `${statusEffect.displayName} in the Ardenfall Compendium.`}
  />
  <link rel="canonical" href={statusEffect.routePath} />
  <meta
    property="og:title"
    content={`${statusEffect.displayName} | Status Effects | Ardenfall Compendium`}
  />
  <meta
    property="og:description"
    content={statusEffect.descriptionText ??
      `${statusEffect.displayName} in the Ardenfall Compendium.`}
  />
  <meta property="og:url" content={statusEffect.routePath} />
  <meta property="og:type" content="article" />
</svelte:head>

<a class="text-sm underline" href={data.statusEffectRoute}>← back to status effects</a>
<h1 class="mt-2 text-2xl font-bold">{statusEffect.displayName}</h1>

<div class="border-border bg-card mt-4 rounded-lg border p-5">
  <dl>
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">Hostile</dt>
      <dd class="mt-1">{statusEffect.isHostile ? "Yes" : "No"}</dd>
    </div>
  </dl>

  <section class="border-border mt-6 border-t pt-5">
    <h2 class="font-semibold">Description</h2>
    {#if statusEffect.description}
      <p class="mt-3 leading-7"><RichText richText={statusEffect.description} /></p>
    {:else}
      <p class="text-muted-foreground mt-3">No description available.</p>
    {/if}
    <p class="text-muted-foreground mt-4 text-sm">
      Strength and duration are set on each reference to this effect, not on the effect itself. The
      numbers in this description are one example, and the same effect can be applied at different
      strengths by different sources.
    </p>
  </section>
</div>
