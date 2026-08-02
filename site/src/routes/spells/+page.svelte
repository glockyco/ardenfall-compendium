<script lang="ts">
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Spells | Ardenfall Compendium</title>
  <meta
    name="description"
    content={`Browse ${data.spells.length} spells grouped by governing skill in the Ardenfall Compendium.`}
  />
  <link rel="canonical" href={data.spellRoute} />
  <meta property="og:title" content="Spells | Ardenfall Compendium" />
  <meta
    property="og:description"
    content={`Browse ${data.spells.length} spells grouped by governing skill in the Ardenfall Compendium.`}
  />
  <meta property="og:url" content={data.spellRoute} />
  <meta property="og:type" content="website" />
</svelte:head>

<h1 class="text-2xl font-bold">Spells</h1>
<p class="text-muted-foreground mt-2">{data.spells.length} deterministic spell records.</p>

{#if data.spells.length > 0}
  <nav class="mt-6" aria-label="Spell groups">
    <p class="text-muted-foreground text-sm">Jump to a governing skill:</p>
    <ul class="mt-2 flex flex-wrap gap-x-4 gap-y-2">
      {#each data.groups as group (group.id)}
        <li><a class="underline underline-offset-2" href={`#${group.id}`}>{group.label}</a></li>
      {/each}
    </ul>
  </nav>
  {#each data.groups as group (group.id)}
    <section class="mt-8" id={group.id}>
      <h2 class="text-xl font-semibold">{group.label}</h2>
      <ul class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {#each group.rows as spell (spell.id)}
          <li class="border-border bg-card rounded-lg border p-4">
            <a class="block underline-offset-4 hover:underline" href={spell.routePath}>
              <span class="block font-medium">{spell.name}</span>
              <span class="text-muted-foreground mt-1 block text-sm">
                {spell.manaCost === null
                  ? "Base mana cost unavailable"
                  : `Base mana cost: ${spell.manaCost}`}
              </span>
            </a>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
{:else}
  <p class="text-muted-foreground mt-4">No spells found.</p>
{/if}
