<script lang="ts">
  import { untrack } from "svelte";
  import { afterNavigate, goto } from "$app/navigation";
  import { MapStore } from "$lib/map/map-store.svelte";
  import { encodeMapState } from "$lib/map/url-state";
  import MapCanvas from "$lib/components/map/MapCanvas.svelte";
  import MapSidebar from "$lib/components/map/MapSidebar.svelte";
  import MapSearch from "$lib/components/map/MapSearch.svelte";
  import DetailsPanel from "$lib/components/map/DetailsPanel.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  // Build-time data is read once; the URL is read on the client after mount,
  // because url.searchParams is not available during prerendering.
  const store = untrack(() => new MapStore(data.mapView));
  let ready = $state(false);

  // afterNavigate runs after the client router is ready (post-hydration), which
  // is when programmatic navigation is safe to call.
  afterNavigate(() => {
    if (ready) return;
    store.hydrateFromSearch(location.search);
    ready = true;
  });

  // Mirror UI state into the URL via goto (the supported way to update query
  // params), using replaceState semantics so transient changes do not stack
  // history entries. The first run only establishes reactive tracking.
  let urlInitialized = false;
  $effect(() => {
    const qs = encodeMapState(store.ui);
    if (!ready) return;
    if (!urlInitialized) {
      urlInitialized = true;
      return;
    }
    const search = qs ? `?${qs}` : "";
    if (search !== location.search) {
      // eslint-disable-next-line svelte/no-navigation-without-resolve -- same-page query sync to the static /map route
      void goto(`${location.pathname}${search}`, {
        replaceState: true,
        keepFocus: true,
        noScroll: true,
      });
    }
  });
</script>

<svelte:head><title>Map · Ardenfall Compendium</title></svelte:head>

<div class="space-y-6">
  <header>
    <h1 class="text-2xl font-semibold tracking-tight">Ardenfall map</h1>
    <p class="text-muted-foreground mt-2 max-w-2xl">
      Explore the characters, locations and portals the game places across the world. The map
      currently has no basemap, so markers show spatial relationships without terrain or roads.
    </p>
  </header>

  <div class="grid gap-4 lg:grid-cols-[260px_1fr]">
    <aside class="space-y-4">
      <MapSearch {store} />
      <MapSidebar {store} />
    </aside>
    <section
      class="border-border relative h-[70vh] min-h-[480px] overflow-hidden rounded-lg border"
    >
      <MapCanvas {store} />
      <noscript>
        <p class="p-4">
          The interactive map requires JavaScript. Browse mapped entities from their linked
          compendium pages.
        </p>
      </noscript>
    </section>
  </div>
</div>

<DetailsPanel {store} />
