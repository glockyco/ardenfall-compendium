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

<div class="border-border rounded-lg border p-4">
  <label class="block">
    <span class="sr-only">Search map markers</span>
    <input
      id="map-search"
      class="border-input-border w-full rounded border px-3 py-2"
      placeholder="Search map markers…"
      bind:value={query}
    />
  </label>
  {#if results.length > 0}
    <ul class="mt-2 space-y-1">
      {#each results as r (r.id)}
        <li>
          <button
            class="hover:text-foreground min-h-11 w-full py-2 text-left"
            onclick={() => store.select(r.nodeShortId)}
          >
            {r.name}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
