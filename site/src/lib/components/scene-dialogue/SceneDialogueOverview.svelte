<script lang="ts">
  import type { SceneDialogueOverviewRow } from "$lib/server/read-models";

  let { rows }: { rows: SceneDialogueOverviewRow[] } = $props();
  const places = (count: number) => (count === 1 ? "1 place" : `${count} places`);
</script>

{#if rows.length > 0}
  <ul class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {#each rows as scene (scene.id)}
      <li class="border-border bg-card rounded-lg border p-4">
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- route paths come from the static read model -->
        <a class="block underline-offset-4 hover:underline" href={scene.routePath}>
          <span class="block font-medium">{scene.name}</span>
        </a>
        <p class="text-muted-foreground mt-1 text-sm">{places(scene.placementCount)}</p>
      </li>
    {/each}
  </ul>
{:else}
  <p class="text-muted-foreground mt-4">No scene dialogue found.</p>
{/if}
