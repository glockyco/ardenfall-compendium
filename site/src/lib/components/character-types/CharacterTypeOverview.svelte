<script lang="ts">
  import type { CharacterTypeOverviewRow } from "$lib/server/read-models";

  let { rows }: { rows: CharacterTypeOverviewRow[] } = $props();
</script>

{#if rows.length > 0}
  <ul class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {#each rows as character (character.id)}
      <li class="border-border bg-card rounded-lg border p-4">
        <a class="block underline-offset-4 hover:underline" href={character.routePath}>
          <span class="block font-medium">
            {#if character.nameIsDescription}<span class="text-muted-foreground text-sm"
                >Description:
              </span>{/if}
            {character.displayName}
          </span>
        </a>
      </li>
    {/each}
  </ul>
{:else}
  <p class="text-muted-foreground mt-4">No character types found.</p>
{/if}
