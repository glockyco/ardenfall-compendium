<script lang="ts">
  import type { MapStore } from "$lib/map/map-store.svelte";

  let { store }: { store: MapStore } = $props();
  const point = $derived(store.selectedPoint);
</script>

{#if point}
  <aside class="mt-4 rounded-lg border p-4">
    <div class="flex items-center justify-between">
      <h2 class="font-semibold">{point.name}</h2>
      <button aria-label="Close details" onclick={() => store.select(null)}>×</button>
    </div>
    <dl class="text-muted-foreground mt-2 grid grid-cols-2 gap-1 text-sm">
      <dt>Map</dt>
      <dd>{point.mapId ?? "—"}</dd>
      <dt>Position</dt>
      <dd>{point.position[0]}, {point.position[1]}</dd>
      <dt>Elevation</dt>
      <dd>{point.elevation}</dd>
      <dt>Fast travel</dt>
      <dd>{point.fastTravel ? "Yes" : "No"}</dd>
    </dl>
  </aside>
{/if}
