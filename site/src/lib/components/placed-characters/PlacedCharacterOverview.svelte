<script lang="ts">
  import type { PlacedCharacterOverviewRow } from "$lib/server/read-models";

  let { rows }: { rows: PlacedCharacterOverviewRow[] } = $props();
</script>

{#if rows.length > 0}
  <ul class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {#each rows as character (character.id)}
      <li class="border-border bg-card rounded-lg border p-4">
        <a class="block underline-offset-4 hover:underline" href={character.routePath}>
          <span class="block font-medium">{character.name}</span>
        </a>
      </li>
    {/each}
  </ul>
{:else}
  <p class="text-muted-foreground mt-4">No placed characters found.</p>
{/if}
