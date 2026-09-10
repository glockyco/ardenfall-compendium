<script lang="ts">
  import type { PlacedPlantOverviewRow } from "$lib/server/read-models";

  let { rows }: { rows: PlacedPlantOverviewRow[] } = $props();
</script>

{#if rows.length > 0}
  <ul class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {#each rows as plant (plant.id)}
      <li class="border-border bg-card rounded-lg border p-4">
        <a class="block underline-offset-4 hover:underline" href={plant.routePath}>
          <span class="block font-medium">{plant.name}</span>
        </a>
        <p class="text-muted-foreground mt-1 text-sm">
          {plant.harvestXp > 0 ? `${plant.harvestXp} XP per harvest` : "No XP per harvest"}
        </p>
      </li>
    {/each}
  </ul>
{:else}
  <p class="text-muted-foreground mt-4">No pickable plants found.</p>
{/if}
