<script lang="ts">
  import AvailabilityNotice from "$lib/components/content/AvailabilityNotice.svelte";
  import type { LocationPresentationRow } from "$lib/server/read-models";

  let { presentation }: { presentation: LocationPresentationRow } = $props();
  const number = (value: number): string =>
    Number.isInteger(value) ? `${value}` : value.toFixed(2);
</script>

<AvailabilityNotice
  flags={presentation.enabled ? [] : [{ kind: "disabled", subject: "location" }]}
/>

<div class="border-border bg-card mt-4 rounded-lg border p-5">
  <dl class="grid gap-4 sm:grid-cols-2">
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">Map</dt>
      <dd class="mt-1">{presentation.mapLabel}</dd>
    </div>
    {#if presentation.mapHref}
      <div>
        <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">Map link</dt>
        <dd class="mt-1">
          <a class="underline underline-offset-2" href={presentation.mapHref}
            >Show this location on the map</a
          >
        </dd>
      </div>
    {/if}
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">Extent</dt>
      <dd class="mt-1">
        {#if presentation.extent}
          {number(presentation.extent.width)} by {number(presentation.extent.height)}
        {:else}
          No mapped volume extent is available.
        {/if}
      </dd>
    </div>
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">Elevation</dt>
      <dd class="mt-1">
        {#if presentation.elevation}
          {number(presentation.elevation.min)} to {number(presentation.elevation.max)}
        {:else}
          No elevation range is available.
        {/if}
      </dd>
    </div>
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">Fast travel</dt>
      <dd class="mt-1">{presentation.allowFastTravel ? "Allowed" : "Not allowed"}</dd>
    </div>
  </dl>
  <p class="text-muted-foreground mt-4 text-sm">
    The extent and elevation numbers have no unit. The game measures them in its own world space,
    and it defines no physical unit for them, so they compare one place with another and mean
    nothing on their own.
  </p>
</div>
