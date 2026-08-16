<script lang="ts">
  import type { CharacterTypePresentationRow } from "$lib/server/read-models";

  let { presentation }: { presentation: CharacterTypePresentationRow } = $props();
  const pageName = $derived(presentation.name);
</script>

<div class="border-border bg-card mt-4 rounded-lg border p-5">
  <dl>
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">
        {presentation.nameIsDescription ? "Description" : "Name"}
      </dt>
      <dd class="mt-1">{pageName}</dd>
    </div>
  </dl>

  <section class="border-border mt-6 border-t pt-5" aria-labelledby="placements-heading">
    <h2 id="placements-heading" class="font-semibold">
      Placements ({presentation.placements.length})
    </h2>
    {#if presentation.placements.length > 0}
      <ul class="mt-3 grid gap-2 sm:grid-cols-2">
        {#each presentation.placements as placement (placement.id)}
          <li class="border-border rounded-md border p-3 text-sm">
            {#if placement.routePath}
              <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- route paths are generated from the static read model -->
              <a class="underline underline-offset-2" href={placement.routePath}
                >{placement.label}</a
              >
            {:else}
              {placement.label}
            {/if}
            {#if placement.mapHref}
              <span aria-hidden="true"> · </span>
              <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- map hrefs are generated from the static read model -->
              <a
                class="underline underline-offset-2"
                href={placement.mapHref}
                aria-label={`Show ${placement.label} on the map`}>Show on map</a
              >
            {/if}
          </li>
        {/each}
      </ul>
    {:else}
      <p class="text-muted-foreground mt-3 text-sm">No placements.</p>
    {/if}
  </section>
</div>
