<script lang="ts">
  import { onMount } from "svelte";
  import { SvelteMap } from "svelte/reactivity";
  import { buildMapLayerSpecs, type LayerSpec } from "$lib/map/layer-spec";
  import { mapAccessibleName, visibleMapMarkers } from "$lib/map/map-accessibility";
  import { composeMapLayers, visibleBasemapTiles } from "$lib/map/basemap";
  import type { MapStore } from "$lib/map/map-store.svelte";
  import type { MapBounds } from "$lib/map/types";
  // Type-only imports are erased at build time, so they do not pull deck.gl into
  // the SSR/prerender graph; the values are imported lazily in onMount below.
  import type { Deck, Layer, OrthographicView, PickingInfo } from "@deck.gl/core";

  let { store }: { store: MapStore } = $props();

  let container: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let loading = $state(true);
  /**
   * Whether deck has drawn a frame at the canvas's real size.
   *
   * deck.gl creates its canvas at the HTML default size and resizes it on its first frames, so the
   * frames before that are the map stretched to the wrong aspect ratio. The canvas stays hidden
   * until its backing store matches its layout box, which is what makes that distortion
   * unobservable rather than merely brief.
   */
  let canvasSized = $state(false);
  let error = $state<string | null>(null);

  // deck handles live in closure scope, never module scope (HMR/leak safety).
  let deck: Deck<OrthographicView> | null = null;
  let makeLayers: ((specs: LayerSpec[]) => Layer[]) | null = null;
  let refreshBasemapLayers: (() => void) | null = null;
  let basemapLayers: Layer[] = [];
  let markerLayers: Layer[] = [];

  const activeMapLabel = $derived(
    store.view.maps.find((map) => map.mapId === store.activeMapId)?.label ?? "Unknown map",
  );
  const visibleMarkers = $derived(
    visibleMapMarkers(
      store.view.points,
      store.activeMapId,
      store.ui.hiddenLayers,
      store.ui.showDebug,
    ),
  );

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

  type MapViewState = {
    target: [number, number, number];
    zoom: number;
    minZoom: number;
    maxZoom: number;
  };

  /**
   * The camera the reader is looking through. deck.gl is driven as a controlled view, so this is
   * the single copy of that state: a pan or zoom writes it, and a layer or selection change reads
   * it back unchanged. Refitting on those would throw away where the reader had navigated to.
   */
  let viewState: MapViewState | null = null;

  /** The map the camera was last fitted to, so switching maps refits and nothing else does. */
  let fittedMapId: string | null = null;

  function fitToVisible(): MapViewState {
    viewState = viewStateForBounds(visibleBounds());
    fittedMapId = store.activeMapId;
    publishCamera();
    return viewState;
  }

  /**
   * Publishes the camera on the container, the way the device type is published. A WebGL canvas
   * carries no readable camera, so this is what lets a test assert that panning survives a layer
   * toggle or a selection instead of asserting on the source that sets it.
   */
  function publishCamera(): void {
    if (!container || !viewState) return;
    container.dataset.deckView = JSON.stringify({
      x: Number(viewState.target[0].toFixed(3)),
      y: Number(viewState.target[1].toFixed(3)),
      zoom: Number(viewState.zoom.toFixed(4)),
    });
  }

  /** Matches the canvas backing store to its layout box, in device pixels. */
  function sizeCanvas(): void {
    const box = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(box.width * ratio));
    const height = Math.max(1, Math.floor(box.height * ratio));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
  }

  /**
   * Reveals the canvas once deck has drawn a frame at the canvas's real size.
   *
   * Sizing the backing store before the first frame covers the ordinary case. A reader who resizes
   * the window mid-load, or a device-pixel ratio deck disagrees with, can still put a smaller
   * backing store behind a larger box, and that frame is the distorted one. `force` bounds the
   * wait: a hidden map is worse than a brief flash.
   */
  function revealWhenCanvasSized(force = false): void {
    if (canvasSized) return;
    const box = canvas.getBoundingClientRect();
    const sized =
      box.width > 0 &&
      box.height > 0 &&
      canvas.width >= Math.floor(box.width) &&
      canvas.height >= Math.floor(box.height);
    if (!force && !sized) return;
    canvasSized = true;
    loading = false;
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
    return buildMapLayerSpecs(store.view.layers, points, volumes, ui);
  }

  function activeBasemap() {
    return store.view.maps.find((map) => map.mapId === store.activeMapId)?.basemap ?? null;
  }

  function syncCanvasLabel(): void {
    const canvas = container?.querySelector("canvas");
    canvas?.setAttribute("aria-label", mapAccessibleName(activeMapLabel, visibleMarkers.length));
  }

  onMount(() => {
    let alive = true;
    let revealTimer: ReturnType<typeof setTimeout> | null = null;
    let disposeBasemapImages = () => {};

    void (async () => {
      // deck.gl is a browser-only WebGL module; static import would execute it
      // during SSR/prerender (no canvas/GPU). Loaded lazily and only here.
      const [core, layersMod] = await Promise.all([
        import("@deck.gl/core"),
        import("@deck.gl/layers"),
      ]);
      if (!alive) return;
      const { Deck, OrthographicView, COORDINATE_SYSTEM } = core;
      const { BitmapLayer, ScatterplotLayer, PolygonLayer } = layersMod;

      let basemapGeneration = 0;
      const imageCache = new SvelteMap<string, Promise<ImageBitmap>>();
      disposeBasemapImages = () => {
        for (const image of imageCache.values()) {
          void image.then(
            (bitmap) => bitmap.close(),
            () => {},
          );
        }
        imageCache.clear();
      };

      const loadBasemapImage = (assetUrl: string): Promise<ImageBitmap> => {
        const cached = imageCache.get(assetUrl);
        if (cached) return cached;
        const loadingImage = fetch(assetUrl)
          .then((response) => {
            if (!response.ok) throw new Error(`Basemap tile request failed: ${response.status}`);
            return response.blob();
          })
          .then((blob) => createImageBitmap(blob))
          .catch((cause: unknown) => {
            imageCache.delete(assetUrl);
            throw cause;
          });
        imageCache.set(assetUrl, loadingImage);
        return loadingImage;
      };

      const updateBasemapLayers = async (): Promise<void> => {
        const generation = ++basemapGeneration;
        const mapId = store.activeMapId;
        const basemap = activeBasemap();
        const camera = viewState;
        if (mapId === null || basemap === null || camera === null) {
          basemapLayers = [];
          deck?.setProps({ layers: composeMapLayers(basemapLayers, markerLayers) });
          return;
        }
        const visibleTiles = visibleBasemapTiles(basemap, {
          target: camera.target,
          zoom: camera.zoom,
          width: container.clientWidth || 800,
          height: container.clientHeight || 480,
        });
        const images = await Promise.all(
          visibleTiles.map(({ tile }) => loadBasemapImage(tile.assetUrl!)),
        );
        if (!alive || generation !== basemapGeneration || mapId !== store.activeMapId) return;

        basemapLayers = visibleTiles.map(
          ({ tile, bounds }, index) =>
            new BitmapLayer({
              id: `basemap::${mapId}::${tile.zoom}/${tile.x}/${tile.y}`,
              image: images[index]!,
              bounds,
              coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
              pickable: false,
            }),
        );
        deck?.setProps({ layers: composeMapLayers(basemapLayers, markerLayers) });
      };

      refreshBasemapLayers = () => {
        void updateBasemapLayers().catch((cause: unknown) => {
          if (!alive) return;
          loading = false;
          error = cause instanceof Error ? cause.message : "Unknown basemap loading error";
        });
      };

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
                // A dark rim keeps a marker legible on sand, water and grass alike; the selected
                // marker swaps it for a white one.
                getLineColor: (d: { nodeShortId?: string | null }) =>
                  spec.selectedNodeShortId !== null && d.nodeShortId === spec.selectedNodeShortId
                    ? [255, 255, 255, 255]
                    : [20, 20, 30, 230],
                getLineWidth: (d: { nodeShortId?: string | null }) =>
                  spec.selectedNodeShortId !== null && d.nodeShortId === spec.selectedNodeShortId
                    ? 3
                    : 1.5,
                lineWidthUnits: "pixels",
                lineWidthMinPixels: 1,
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

      markerLayers = makeLayers(currentSpecs());

      // deck.gl adopts a canvas it is given and creates one at the HTML default 300x150 otherwise,
      // which CSS then stretches across the map box until deck's own resize catches up. Sizing the
      // backing store before the first frame is what removes the distorted flash at load.
      sizeCanvas();
      deck = new Deck({
        canvas,
        // GPU device; deck.gl 9 defaults powerPreference to 'high-performance'.
        deviceProps: { type: "webgl" },
        views: new OrthographicView({ id: "map", flipY: false, controller: true }),
        viewState: fitToVisible(),
        onViewStateChange: ({ viewState: next }) => {
          viewState = next as MapViewState;
          publishCamera();
          deck?.setProps({
            viewState,
            layers: composeMapLayers(basemapLayers, markerLayers),
          });
          refreshBasemapLayers?.();
        },
        layers: composeMapLayers(basemapLayers, markerLayers),
        // Expose the resolved GPU device type for the browser smoke assertion.
        onDeviceInitialized: (device) => {
          container.dataset.deckDevice = device.type;
          syncCanvasLabel();
        },
        onLoad: () => revealWhenCanvasSized(),
        onAfterRender: () => revealWhenCanvasSized(),
        getTooltip: (info: PickingInfo) => {
          const object = info.object as { tooltip?: string; name?: string } | null;
          return object ? { text: object.tooltip ?? object.name ?? "" } : null;
        },
        onClick: (info: PickingInfo) => {
          // A click that hits nothing is almost always a missed marker or a stopped drag, so it
          // leaves the selection alone. The details panel carries the one control that clears it.
          if (!info.object) return;
          const picked = info.object as { nodeShortId?: string | null };
          if (picked.nodeShortId) store.select(picked.nodeShortId);
        },
      });
      refreshBasemapLayers();
      // A hidden canvas is worse than a distorted frame, so the wait is bounded: if deck reports
      // no frame at the right size, the map is shown anyway.
      revealTimer = setTimeout(() => revealWhenCanvasSized(true), 2000);
    })().catch((cause: unknown) => {
      if (!alive) return;
      loading = false;
      error = cause instanceof Error ? cause.message : "Unknown map loading error";
    });

    return () => {
      alive = false;
      if (revealTimer !== null) clearTimeout(revealTimer);
      deck?.finalize();
      deck = null;
      makeLayers = null;
      refreshBasemapLayers = null;
      basemapLayers = [];
      markerLayers = [];
      disposeBasemapImages();
    };
  });

  // Re-apply layers when layer visibility, the active map, or the selection changes. The camera
  // moves only when the reader moves it, or when the active map changes and the old camera points
  // at coordinates the new map does not use.
  $effect(() => {
    const specs = currentSpecs();
    syncCanvasLabel();
    if (!deck || !makeLayers) return;
    const mapChanged = store.activeMapId !== fittedMapId;
    const nextViewState = mapChanged ? fitToVisible() : viewState;
    markerLayers = makeLayers(specs);
    if (mapChanged) basemapLayers = [];
    deck.setProps({
      layers: composeMapLayers(basemapLayers, markerLayers),
      viewState: nextViewState,
    });
    if (mapChanged) refreshBasemapLayers?.();
  });
</script>

<div
  bind:this={container}
  class="absolute inset-0"
  role="region"
  aria-label={mapAccessibleName(activeMapLabel, visibleMarkers.length)}
>
  <!--
    The reveal is a style on the canvas, not a class on the container: deck.gl writes the
    container's class attribute when it mounts its widget root, which drops a class set here.
  -->
  <canvas
    bind:this={canvas}
    class="block h-full w-full transition-opacity duration-150"
    style:opacity={canvasSized ? 1 : 0}
  ></canvas>
</div>
<details
  class="bg-card absolute top-4 right-4 z-10 max-h-[50%] max-w-sm overflow-auto rounded border p-3"
>
  <summary class="cursor-pointer font-semibold">
    Text list of markers on {activeMapLabel} ({visibleMarkers.length})
  </summary>
  {#if visibleMarkers.length > 0}
    <ul class="mt-2 space-y-1">
      {#each visibleMarkers as marker (marker.id)}
        <li>
          {#if marker.routePath && marker.hasPage}
            <a
              class="underline underline-offset-2"
              href={marker.routePath}
              aria-label={`Open ${marker.name} detail page`}>{marker.name}</a
            >
          {:else}
            <span>{marker.name}</span>
          {/if}
        </li>
      {/each}
    </ul>
  {:else}
    <p class="text-muted-foreground mt-2">No markers are currently shown on {activeMapLabel}.</p>
  {/if}
</details>
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
