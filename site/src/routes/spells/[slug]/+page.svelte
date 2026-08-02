<script lang="ts">
  import RichText from "$lib/components/content/RichText.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const spell = $derived(data.presentation);
</script>

<svelte:head>
  <title>{spell.name} | Spells | Ardenfall Compendium</title>
  <meta
    name="description"
    content={spell.descriptionText ?? `${spell.name} in the Ardenfall Compendium.`}
  />
  <link rel="canonical" href={spell.routePath} />
  <meta property="og:title" content={`${spell.name} | Spells | Ardenfall Compendium`} />
  <meta
    property="og:description"
    content={spell.descriptionText ?? `${spell.name} in the Ardenfall Compendium.`}
  />
  <meta property="og:url" content={spell.routePath} />
  <meta property="og:type" content="article" />
</svelte:head>

<a class="text-sm underline" href={data.spellRoute}>← back to spells</a>
<h1 class="mt-2 text-2xl font-bold">{spell.name}</h1>

<div class="border-border bg-card mt-4 rounded-lg border p-5">
  <dl class="grid gap-4 sm:grid-cols-2">
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">
        Governing skill
      </dt>
      <dd class="mt-1">
        {#if spell.skill && spell.skillRoutePath}
          <a class="underline underline-offset-2" href={spell.skillRoutePath}>{spell.skill}</a>
        {:else}
          {spell.skill ?? "No governing skill"}
        {/if}
        {#if spell.skill}
          <p class="text-muted-foreground mt-1 text-sm">Spell power scales with this skill.</p>
        {/if}
      </dd>
    </div>
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">
        Base mana cost
      </dt>
      <dd class="mt-1">
        {spell.manaCost === null ? "Unavailable" : `${spell.manaCost} mana`}
        {#if spell.manaCost !== null}
          <p class="text-muted-foreground mt-1 text-sm">
            Mana spent varies with spell level and item modifiers.
          </p>
        {/if}
      </dd>
    </div>
  </dl>

  <section class="border-border mt-6 border-t pt-5">
    <h2 class="font-semibold">Description</h2>
    <p class="text-muted-foreground mt-2 text-sm">
      This is a level 1 sample. In play, spell level is derived from the player's Intelligence and
      governing skill.
    </p>
    {#if spell.description}
      <p class="mt-3 leading-7"><RichText richText={spell.description} /></p>
    {:else}
      <p class="text-muted-foreground mt-3">No description available.</p>
    {/if}
  </section>

  {#if spell.isIllegal}
    <p class="text-muted-foreground mt-6 text-sm">Illegal spell</p>
  {/if}
</div>
