<script lang="ts">
  import type { LocationOverviewRow } from "$lib/server/read-models";

  let { rows }: { rows: LocationOverviewRow[] } = $props();
</script>

{#if rows.length > 0}
  <ul class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {#each rows as location (location.id)}
      <li class="border-border bg-card rounded-lg border p-4">
        <a class="block underline-offset-4 hover:underline" href={location.routePath}>
          <span class="block font-medium">{location.name}</span>
        </a>
      </li>
    {/each}
  </ul>
{:else}
  <p class="text-muted-foreground mt-4">No locations found.</p>
{/if}
