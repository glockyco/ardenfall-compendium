<script lang="ts">
  import type { WorldSpawnOverviewRow } from "$lib/server/read-models";

  let { rows }: { rows: WorldSpawnOverviewRow[] } = $props();
</script>

{#if rows.length > 0}
  <ul class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {#each rows as spawn (spawn.id)}
      <li class="border-border bg-card rounded-lg border p-4">
        <a class="block underline-offset-4 hover:underline" href={spawn.routePath}>
          <span class="block font-medium">{spawn.name}</span>
        </a>
        <p class="text-muted-foreground mt-1 text-sm">
          {spawn.kind === "local" ? "Spawns a definition" : "Places a recorded character"}
        </p>
      </li>
    {/each}
  </ul>
{:else}
  <p class="text-muted-foreground mt-4">No world spawns found.</p>
{/if}
