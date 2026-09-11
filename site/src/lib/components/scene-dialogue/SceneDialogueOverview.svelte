<script lang="ts">
  import type { SceneDialogueOverviewRow } from "$lib/server/read-models";

  let { rows }: { rows: SceneDialogueOverviewRow[] } = $props();
  const lines = (count: number) => (count === 1 ? "1 line" : `${count} lines`);
  const places = (count: number) => (count === 1 ? "1 place" : `${count} places`);
</script>

{#if rows.length > 0}
  <ul class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {#each rows as dialogue (dialogue.id)}
      <li class="border-border bg-card rounded-lg border p-4">
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- route paths come from the static read model -->
        <a class="block underline-offset-4 hover:underline" href={dialogue.routePath}>
          <span class="block font-medium">{dialogue.name}</span>
        </a>
        <p class="text-muted-foreground mt-1 text-sm">
          {lines(dialogue.lineCount)} · {places(dialogue.placementCount)}
        </p>
      </li>
    {/each}
  </ul>
{:else}
  <p class="text-muted-foreground mt-4">No scene dialogue found.</p>
{/if}
