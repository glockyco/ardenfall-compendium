<script lang="ts">
  import type { MapStore } from "$lib/map/map-store.svelte";

  let { store }: { store: MapStore } = $props();
  const rgb = (c: [number, number, number, number]) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
</script>

<div class="space-y-4 rounded-lg border p-4">
  <div>
    <h2 class="mb-2 font-semibold">Layers</h2>
    <ul class="space-y-1">
      {#each store.view.layers as layer (layer.layerId)}
        <li>
          <label class="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!store.ui.hiddenLayers.includes(layer.layerId)}
              onchange={() => store.toggleLayer(layer.layerId)}
            />
            <span
              class="inline-block h-3 w-3 rounded-full"
              style:background-color={rgb(layer.fillColor)}
            ></span>
            {layer.legendLabel}
          </label>
        </li>
      {/each}
    </ul>
  </div>

  <div>
    <h2 class="mb-2 font-semibold">Filters</h2>
    <label class="flex items-center gap-2">
      <input type="checkbox" bind:checked={store.ui.showDebug} /> Show debug-only
    </label>
    <label class="flex items-center gap-2">
      <input type="checkbox" bind:checked={store.ui.fastTravelOnly} /> Fast-travel only
    </label>
  </div>

  {#if store.view.maps.length > 1}
    <div>
      <h2 class="mb-2 font-semibold">Map</h2>
      <select class="w-full rounded border px-2 py-1" bind:value={store.ui.mapId}>
        {#each store.view.maps as m (m.mapId)}
          <option value={m.mapId}>{m.label}</option>
        {/each}
      </select>
    </div>
  {/if}
</div>
