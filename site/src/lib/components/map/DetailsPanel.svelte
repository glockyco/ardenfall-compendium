<script lang="ts">
  import type { MapStore } from "$lib/map/map-store.svelte";

  let { store }: { store: MapStore } = $props();
  const point = $derived(store.selectedPoint);
  const leadsTo = $derived(point?.leadsTo ?? null);
  const mapLabel = $derived(
    store.view.maps.find((map) => map.mapId === point?.mapId)?.label ?? "Unknown",
  );
  const layerLabel = $derived(
    store.view.layers.find((layer) => layer.layerId === point?.layerId)?.legendLabel ?? "Unknown",
  );

  let panel = $state<HTMLElement | undefined>();
  let heading = $state<HTMLHeadingElement | undefined>();

  $effect(() => {
    const selected = store.ui.selected;
    if (!selected || typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 1023px)").matches) return;
    requestAnimationFrame(() => {
      if (store.ui.selected !== selected || !panel || !heading) return;
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
      heading.focus({ preventScroll: true });
    });
  });
</script>

{#if point}
  <aside bind:this={panel} class="border-border mt-4 rounded-lg border p-4">
    <div class="flex items-center justify-between">
      <h2 bind:this={heading} tabindex="-1" class="font-semibold">{point.name}</h2>
      <button
        class="min-h-11 min-w-11 px-2"
        aria-label="Close details"
        onclick={() => store.select(null)}>×</button
      >
    </div>
    <dl class="text-muted-foreground mt-2 grid grid-cols-2 gap-1 text-sm">
      <dt>Layer</dt>
      <dd>{layerLabel}</dd>
      <dt>Map</dt>
      <dd>{mapLabel}</dd>
      {#if store.ui.showDebug}
        <dt>Position (debug)</dt>
        <dd>{point.position[0]}, {point.position[1]}</dd>
        <dt>Elevation (debug)</dt>
        <dd>{point.elevation}</dd>
      {/if}
      {#if leadsTo}
        <dt>Leads to</dt>
        <dd>
          <button
            class="hover:text-foreground text-left underline underline-offset-2"
            onclick={() => store.goToPoint(leadsTo.shortId)}
          >
            {leadsTo.label}
          </button>
        </dd>
      {/if}
    </dl>
  </aside>
{/if}
