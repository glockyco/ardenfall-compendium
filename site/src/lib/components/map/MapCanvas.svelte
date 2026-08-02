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
  let error = $state<string | null>(null);

  // deck handles live in closure scope, never module scope (HMR/leak safety).
  let deck: Deck<OrthographicView> | null = null;
  let makeLayers: ((specs: LayerSpec[]) => Layer[]) | null = null;

  function visibleBounds(): MapBounds | null {
    const mapId = store.activeMapId;
    const visibleLayers = new Set(
      store.view.layers
        .filter((layer) => !store.ui.hiddenLayers.includes(layer.layerId))
        .map((layer) => layer.layerId),
    );
    let result: MapBounds | null = null;
    const extend = (x: number, y: number): void => {
      result = result
        ? {
            minX: Math.min(result.minX, x),
            minY: Math.min(result.minY, y),
            maxX: Math.max(result.maxX, x),
            maxY: Math.max(result.maxY, y),
          }
        : { minX: x, minY: y, maxX: x, maxY: y };
    };

    for (const point of store.view.points) {
      if (
        point.mapId === mapId &&
        visibleLayers.has(point.layerId) &&
        (store.ui.showDebug || !point.debugOnly)
      ) {
        extend(point.position[0], point.position[1]);
      }
    }
    for (const volume of store.view.volumes) {
      if (volume.mapId !== mapId || !visibleLayers.has(volume.layerId)) continue;
      for (const [x, y] of volume.ring) extend(x, y);
    }
    return result;
  }

  function viewStateForBounds(b: MapBounds | null): {
    target: [number, number, number];
    zoom: number;
    minZoom: number;
    maxZoom: number;
  } {
    if (!b) return { target: [0, 0, 0], zoom: 0, minZoom: -10, maxZoom: 10 };
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 480;
    const pad = 40;
    const spanX = Math.max(b.maxX - b.minX, 1);
    const spanY = Math.max(b.maxY - b.minY, 1);
    const zoom = Math.min(
      Math.log2(Math.max(w - 2 * pad, 1) / spanX),
      Math.log2(Math.max(h - 2 * pad, 1) / spanY),
    );
    return {
      target: [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, 0],
      zoom: Number.isFinite(zoom) ? zoom : 0,
      minZoom: -10,
      maxZoom: 10,
    };
  }

  function initialViewState(): {
    target: [number, number, number];
    zoom: number;
    minZoom: number;
    maxZoom: number;
  } {
    return viewStateForBounds(visibleBounds());
  }

  function currentSpecs(): LayerSpec[] {
    const ui = {
      hiddenLayers: store.ui.hiddenLayers,
      showDebug: store.ui.showDebug,
      selected: store.ui.selected,
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
                getRadius: (d: { nodeShortId?: string | null }) =>
                  (spec.radius ?? 6) +
                  (spec.selectedNodeShortId !== null && d.nodeShortId === spec.selectedNodeShortId
                    ? 4
                    : 0),
                radiusUnits: "pixels",
                getFillColor: spec.fillColor,
                stroked: true,
                getLineColor: (d: { nodeShortId?: string | null }) =>
                  spec.selectedNodeShortId !== null && d.nodeShortId === spec.selectedNodeShortId
                    ? [255, 255, 255, 255]
                    : spec.fillColor,
                getLineWidth: (d: { nodeShortId?: string | null }) =>
                  spec.selectedNodeShortId !== null && d.nodeShortId === spec.selectedNodeShortId
                    ? 3
                    : 0,
                lineWidthUnits: "pixels",
                lineWidthMinPixels: 0,
                autoHighlight: true,
                updateTriggers: {
                  getRadius: [spec.radius, spec.selectedNodeShortId],
                  getFillColor: spec.fillColor,
                  getLineColor: spec.selectedNodeShortId,
                  getLineWidth: spec.selectedNodeShortId,
                },
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
        onViewStateChange: ({ viewState }) => {
          deck?.setProps({ viewState });
        },
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
    })().catch((cause: unknown) => {
      if (!alive) return;
      loading = false;
      error = cause instanceof Error ? cause.message : "Unknown map loading error";
    });

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
    if (deck && makeLayers) {
      deck.setProps({
        layers: makeLayers(currentSpecs()),
        viewState: viewStateForBounds(visibleBounds()),
      });
    }
  });

  $effect(() => {
    void store.ui.selected;
    if (deck && makeLayers) deck.setProps({ layers: makeLayers(currentSpecs()) });
  });
</script>

<div bind:this={container} class="absolute inset-0"></div>
{#if loading}
  <p role="status" class="text-muted-foreground pointer-events-none absolute top-4 left-4">
    Loading map…
  </p>
{:else if error}
  <p role="alert" class="text-muted-foreground bg-card absolute top-4 left-4 max-w-sm rounded p-3">
    The interactive map could not load. Use the <a
      class="underline underline-offset-2"
      href="#map-search">search box</a
    >
    or linked compendium pages instead. ({error})
  </p>
{/if}
