<script lang="ts">
  import type { MapStore } from "$lib/map/map-store.svelte";
  import {
    MAP_SEARCH_RESULT_LIMIT,
    mapMarkerSearchMatches,
    mapSearchEmptyState,
  } from "$lib/map/map-accessibility";

  let { store }: { store: MapStore } = $props();
  let query = $state("");
  const activeMapLabel = $derived(
    store.view.maps.find((map) => map.mapId === store.activeMapId)?.label ?? "Unknown map",
  );
  const matchingResults = $derived(
    mapMarkerSearchMatches(store.view.points, store.activeMapId, query),
  );
  const results = $derived(matchingResults.slice(0, MAP_SEARCH_RESULT_LIMIT));
  const otherMapLabels = $derived.by(() =>
    store.view.maps
      .filter((map) => map.mapId !== store.activeMapId)
      .filter((map) => mapMarkerSearchMatches(store.view.points, map.mapId, query).length > 0)
      .map((map) => map.label),
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
  {#if query.trim().length > 0}
    <div aria-live="polite" class="text-muted-foreground mt-2 text-sm">
      <p>
        Showing {results.length} of {matchingResults.length} matching markers on {activeMapLabel}
      </p>
      {#if matchingResults.length === 0}
        <p class="mt-2">{mapSearchEmptyState(query, activeMapLabel, otherMapLabels)}</p>
      {/if}
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
  {/if}
</div>
