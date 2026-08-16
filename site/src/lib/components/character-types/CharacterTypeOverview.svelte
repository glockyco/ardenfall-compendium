<script lang="ts">
  import type { CharacterTypeOverviewRow } from "$lib/server/read-models";

  let { rows }: { rows: CharacterTypeOverviewRow[] } = $props();
</script>

{#if rows.length > 0}
  <ul class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {#each rows as character (character.id)}
      <li class="border-border bg-card rounded-lg border p-4">
        <div class="flex items-baseline gap-2">
          {#if character.nameIsDescription}
            <span class="text-muted-foreground text-sm">Description</span>
          {/if}
          <a class="font-medium underline-offset-4 hover:underline" href={character.routePath}>
            {character.displayName}
          </a>
        </div>
      </li>
    {/each}
  </ul>
{:else}
  <p class="text-muted-foreground mt-4">No character types found.</p>
{/if}
