<script lang="ts">
  import type { ContainerOverviewRow } from "$lib/server/read-models";

  let { rows }: { rows: ContainerOverviewRow[] } = $props();
</script>

{#if rows.length > 0}
  <ul class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {#each rows as container (container.id)}
      <li class="border-border bg-card rounded-lg border p-4">
        <a class="block underline-offset-4 hover:underline" href={container.routePath}>
          <span class="block font-medium">{container.name}</span>
        </a>
        {#if container.lockMode !== "Unlocked"}
          <p class="text-muted-foreground mt-1 text-sm">Locked</p>
        {/if}
      </li>
    {/each}
  </ul>
{:else}
  <p class="text-muted-foreground mt-4">No containers found.</p>
{/if}
