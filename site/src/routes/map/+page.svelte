<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { browser } from "$app/environment";
  import { replaceState } from "$app/navigation";
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
  let hydrated = $state(false);

  onMount(() => {
    store.hydrateFromSearch(location.search);
    hydrated = true;
  });

  // Reflect UI state into the URL so every view/selection is shareable.
  $effect(() => {
    const qs = encodeMapState(store.ui);
    if (!hydrated || !browser) return;
    const search = qs ? `?${qs}` : "";
    if (search !== location.search) {
      // eslint-disable-next-line svelte/no-navigation-without-resolve -- shallow same-page query sync; only the query string changes on the static /map route
      replaceState(`${location.pathname}${search}`, {});
    }
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
