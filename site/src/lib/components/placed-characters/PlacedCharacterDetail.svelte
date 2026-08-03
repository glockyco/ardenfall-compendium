<script lang="ts">
  import type { PlacedCharacterPresentationRow } from "$lib/server/read-models";

  let { presentation }: { presentation: PlacedCharacterPresentationRow } = $props();
  const number = (value: number): string =>
    Number.isInteger(value) ? `${value}` : value.toFixed(2);
</script>

<div class="border-border bg-card mt-4 rounded-lg border p-5">
  <dl class="grid gap-4 sm:grid-cols-2">
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">Map</dt>
      <dd class="mt-1">{presentation.mapLabel}</dd>
    </div>
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">Coordinates</dt>
      <dd class="mt-1">{number(presentation.mapX)}, {number(presentation.mapY)}</dd>
    </div>
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">Elevation</dt>
      <dd class="mt-1">{number(presentation.elevation)}</dd>
    </div>
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">Map link</dt>
      <dd class="mt-1">
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the map query comes from the static read model -->
        <a class="underline underline-offset-2" href={`/map?${presentation.mapQuery}`}
          >Show this character on the map</a
        >
      </dd>
    </div>
  </dl>

  <section class="mt-6" aria-labelledby="placed-character-locations">
    <h2 id="placed-character-locations" class="font-semibold">Locations</h2>
    {#if presentation.locations.length > 0}
      <ul class="mt-2 list-disc space-y-1 pl-5">
        {#each presentation.locations as location (location.id)}
          <li>
            <a class="underline underline-offset-2" href={location.routePath}>{location.label}</a>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="text-muted-foreground mt-2">No containing locations are recorded.</p>
    {/if}
  </section>
</div>
