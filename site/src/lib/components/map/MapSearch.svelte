<script lang="ts">
  import type { MapStore } from "$lib/map/map-store.svelte";

  let { store }: { store: MapStore } = $props();
  let query = $state("");
  const results = $derived(
    query.trim().length === 0
      ? []
      : store.view.points
          .filter(
            (p) =>
              p.mapId === store.activeMapId && p.name.toLowerCase().includes(query.toLowerCase()),
          )
          .slice(0, 12),
  );
</script>

<div class="rounded-lg border p-4">
  <label class="block">
    <span class="sr-only">Search locations</span>
    <input
      class="w-full rounded border px-2 py-1"
      placeholder="Search locations…"
      bind:value={query}
    />
  </label>
  {#if results.length > 0}
    <ul class="mt-2 space-y-1">
      {#each results as r (r.id)}
        <li>
          <button
            class="hover:text-foreground w-full text-left"
            onclick={() => store.select(r.nodeShortId)}
          >
            {r.name}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
