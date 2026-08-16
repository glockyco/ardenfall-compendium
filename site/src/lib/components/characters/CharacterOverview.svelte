<script lang="ts">
  import type { CharacterOverviewRow } from "$lib/server/read-models";

  let { rows }: { rows: CharacterOverviewRow[] } = $props();
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
            {character.name}
          </span>
        </a>
        {#if character.locations.length > 0}
          <p class="text-muted-foreground mt-1 text-sm">
            {#each character.locations as location, index (location.id)}
              {#if index > 0},
              {/if}
              <a class="underline underline-offset-2" href={location.routePath}>{location.label}</a>
            {/each}
          </p>
        {/if}
      </li>
    {/each}
  </ul>
{:else}
  <p class="text-muted-foreground mt-4">No characters found.</p>
{/if}
