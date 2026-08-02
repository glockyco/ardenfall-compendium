<script lang="ts">
  import { onMount } from "svelte";
  import { buildEntityLayerSpecs, type LayerSpec } from "$lib/map/layer-spec";
  import type { MapStore } from "$lib/map/map-store.svelte";
  import type { MapBounds } from "$lib/map/types";
  // Type-only imports are erased at build time, so they do not pull deck.gl into
  // the SSR/prerender graph; the values are imported lazily in onMount below.
  import type { Deck, Layer, OrthographicView, PickingInfo } from "@deck.gl/core";

  let { store }: { store: MapStore } = $props();

  let container: HTMLDivElement;
  let loading = $state(true);

  // deck handles live in closure scope, never module scope (HMR/leak safety).
  let deck: Deck<OrthographicView> | null = null;
  let makeLayers: ((specs: LayerSpec[]) => Layer[]) | null = null;

  function activeBounds(): MapBounds | null {
    return store.view.maps.find((m) => m.mapId === store.activeMapId)?.bounds ?? null;
  }

  function initialViewState(): {
    target: [number, number, number];
    zoom: number;
    minZoom: number;
    maxZoom: number;
  } {
    const b = activeBounds();
    if (!b) return { target: [0, 0, 0], zoom: 0, minZoom: -10, maxZoom: 10 };
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 480;
    const pad = 40;
    const spanX = b.maxX - b.minX || 1;
    const spanY = b.maxY - b.minY || 1;
    const zoom = Math.min(Math.log2((w - 2 * pad) / spanX), Math.log2((h - 2 * pad) / spanY));
    return {
      target: [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, 0],
      zoom: Number.isFinite(zoom) ? zoom : 0,
      minZoom: -10,
      maxZoom: 10,
    };
  }

  function currentSpecs(): LayerSpec[] {
    const ui = {
      hiddenLayers: store.ui.hiddenLayers,
      showDebug: store.ui.showDebug,
    };
    const mapId = store.activeMapId;
    const points = store.view.points.filter((p) => p.mapId === mapId);
    const volumes = store.view.volumes.filter((v) => v.mapId === mapId);
    return store.view.layers.flatMap((layer) => buildEntityLayerSpecs(layer, points, volumes, ui));
  }

  onMount(() => {
    let alive = true;

    void (async () => {
      // deck.gl is a browser-only WebGL module; static import would execute it
      // during SSR/prerender (no canvas/GPU). Loaded lazily and only here.
      const [core, layersMod] = await Promise.all([
        import("@deck.gl/core"),
        import("@deck.gl/layers"),
      ]);
      if (!alive) return;
      const { Deck, OrthographicView, COORDINATE_SYSTEM } = core;
      const { ScatterplotLayer, PolygonLayer } = layersMod;

      makeLayers = (specs) =>
        specs.map((spec) =>
          spec.kind === "scatterplot"
            ? new ScatterplotLayer({
                id: spec.id,
                data: spec.data,
                visible: spec.visible,
                pickable: spec.pickable,
                coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
                getPosition: (d: { position: [number, number, number] }) => d.position,
                getRadius: spec.radius ?? 6,
                radiusUnits: "pixels",
                getFillColor: spec.fillColor,
                autoHighlight: true,
                updateTriggers: { getRadius: spec.radius, getFillColor: spec.fillColor },
              })
            : new PolygonLayer({
                id: spec.id,
                data: spec.data,
                visible: spec.visible,
                pickable: spec.pickable,
                coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
                positionFormat: "XY",
                getPolygon: (d: { ring: [number, number][] }) => d.ring,
                filled: true,
                stroked: true,
                getFillColor: [spec.fillColor[0], spec.fillColor[1], spec.fillColor[2], 60],
                getLineColor: spec.fillColor,
                lineWidthUnits: "pixels",
                lineWidthMinPixels: 1,
              }),
        );

      deck = new Deck({
        parent: container,
        // GPU device; deck.gl 9 defaults powerPreference to 'high-performance'.
        deviceProps: { type: "webgl" },
        views: new OrthographicView({ id: "map", flipY: false, controller: true }),
        initialViewState: initialViewState(),
        layers: makeLayers(currentSpecs()),
        // Expose the resolved GPU device type for the browser smoke assertion.
        onDeviceInitialized: (device) => {
          container.dataset.deckDevice = device.type;
        },
        getTooltip: (info: PickingInfo) => {
          const object = info.object as { tooltip?: string; name?: string } | null;
          return object ? { text: object.tooltip ?? object.name ?? "" } : null;
        },
        onClick: (info: PickingInfo) => {
          const object = info.object as { nodeShortId?: string | null } | null;
          store.select(object?.nodeShortId ?? null);
        },
      });
      loading = false;
    })();

    return () => {
      alive = false;
      deck?.finalize();
      deck = null;
      makeLayers = null;
    };
  });

  // Re-apply layers when visibility or active-map state changes.
  $effect(() => {
    void [store.ui.hiddenLayers, store.ui.showDebug, store.ui.mapId];
    if (deck && makeLayers) deck.setProps({ layers: makeLayers(currentSpecs()) });
  });
</script>

<div bind:this={container} class="absolute inset-0"></div>
{#if loading}
  <p class="text-muted-foreground pointer-events-none absolute top-4 left-4">Loading map…</p>
{/if}
