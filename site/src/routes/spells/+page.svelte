<script lang="ts">
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Spells | Ardenfall Compendium</title>
</svelte:head>

<h1 class="text-2xl font-bold">Spells</h1>
<p class="text-muted-foreground mt-2">{data.spells.length} deterministic spell records.</p>

{#if data.spells.length > 0}
  <section class="mt-8">
    <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {#each data.spells as spell (spell.id)}
        <li class="border-border bg-card rounded-lg border p-4">
          <a class="block underline-offset-4 hover:underline" href={spell.routePath}>
            <span class="block font-medium">{spell.name}</span>
            <span class="text-muted-foreground mt-1 block text-sm">
              {spell.school ?? "No school"} ·
              {spell.manaCost === null ? "Mana cost unavailable" : `${spell.manaCost} mana`}
            </span>
          </a>
        </li>
      {/each}
    </ul>
  </section>
{:else}
  <p class="text-muted-foreground mt-4">No spells found.</p>
{/if}
