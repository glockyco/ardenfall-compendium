<script lang="ts">
  import BackLink from "$lib/components/navigation/BackLink.svelte";
  import CharacterDetail from "$lib/components/characters/CharacterDetail.svelte";
  import RelationshipSection from "$lib/components/relationships/RelationshipSection.svelte";
  import DialogueSection from "$lib/components/content/DialogueSection.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const character = $derived(data.presentation);
  const titleLabel = $derived(
    character.nameIsDescription ? `Description: ${character.name}` : character.name,
  );
</script>

<svelte:head>
  <title>{titleLabel} | Characters | Ardenfall Compendium</title>
  <meta name="description" content={`${titleLabel} in the Ardenfall Compendium.`} />
  <link rel="canonical" href={character.routePath} />
  <meta property="og:title" content={`${titleLabel} | Characters | Ardenfall Compendium`} />
  <meta property="og:description" content={`${titleLabel} in the Ardenfall Compendium.`} />
  <meta property="og:url" content={character.routePath} />
  <meta property="og:type" content="article" />
</svelte:head>

<BackLink href={data.characterRoute} label="characters" />
<h1 class="mt-2 text-2xl font-bold">
  {#if character.nameIsDescription}<span class="text-muted-foreground text-base"
      >Description:
    </span>{/if}
  {character.name}
</h1>
<p class="text-muted-foreground mt-1">
  {#if character.characterType}
    This character is identified as
    {#if character.characterType.routePath}
      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- route paths are generated from the static read model -->
      <a class="underline underline-offset-2" href={character.characterType.routePath}>
        {character.characterType.label}
      </a>.
    {:else}
      {character.characterType.label}.
    {/if}
    {#if character.displayNameProvenance === "inherited"}
      Its name comes from this character type.
    {:else if character.displayNameProvenance === "absent"}
      The game gives this character its name when you meet it.
    {/if}
  {:else}
    The game does not say what this character is.
  {/if}
</p>

<CharacterDetail presentation={character} />
<DialogueSection groups={character.dialogue} heading="Dialogue" />

<div class="mt-6 grid gap-6">
  {#each data.relationships as section (section.id)}
    <RelationshipSection {section} />
  {/each}
</div>
