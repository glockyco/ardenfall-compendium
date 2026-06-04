<script lang="ts">
  import { untrack } from "svelte";
  import { page } from "$app/state";
  import { replaceState } from "$app/navigation";
  import { MapStore } from "$lib/map/map-store.svelte";
  import { decodeMapState, encodeMapState } from "$lib/map/url-state";
  import MapCanvas from "$lib/components/map/MapCanvas.svelte";
  import MapSidebar from "$lib/components/map/MapSidebar.svelte";
  import MapSearch from "$lib/components/map/MapSearch.svelte";
  import DetailsPanel from "$lib/components/map/DetailsPanel.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  // Build-time data and the initial URL are read once; the store owns UI state.
  const store = untrack(() => new MapStore(data.mapView, decodeMapState(page.url.searchParams)));

  // Reflect UI state into the URL so every view/selection is shareable.
  $effect(() => {
    const qs = encodeMapState(store.ui);
    const search = qs ? `?${qs}` : "";
    // eslint-disable-next-line svelte/no-navigation-without-resolve -- shallow same-page query sync; only the query string changes on the static /map route
    if (search !== page.url.search) replaceState(`${page.url.pathname}${search}`, {});
  });
</script>

<svelte:head><title>Map · Ardenfall Compendium</title></svelte:head>

<div class="grid gap-4 lg:grid-cols-[260px_1fr]">
  <aside class="space-y-4">
    <MapSearch {store} />
    <MapSidebar {store} />
  </aside>
  <section class="relative h-[70vh] min-h-[480px] overflow-hidden rounded-lg border">
    <MapCanvas {store} />
    <noscript>
      <p class="p-4">
        The interactive map requires JavaScript. Browse locations from the linked compendium pages.
      </p>
    </noscript>
  </section>
</div>

<DetailsPanel {store} />
