<script lang="ts">
  import type { PlacedCharacterPresentationRow } from "$lib/server/read-models";

  let { presentation }: { presentation: PlacedCharacterPresentationRow } = $props();
  const number = (value: number): string =>
    Number.isInteger(value) ? `${value}` : value.toFixed(2);
</script>

<div class="border-border bg-card mt-4 rounded-lg border p-5">
  <dl class="grid gap-4 sm:grid-cols-2">
    {#if presentation.displayNameProvenance === "inherited"}
      <div>
        <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">
          Name source
        </dt>
        <dd class="mt-1">
          This name comes from the character type: {presentation.displayNameOwner}
        </dd>
      </div>
    {:else if presentation.displayNameProvenance === "absent"}
      <div>
        <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">
          Name source
        </dt>
        <dd class="mt-1">The game gives this character no name.</dd>
      </div>
    {/if}
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
    {#if presentation.mapHref}
      <div>
        <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">Map link</dt>
        <dd class="mt-1">
          <a class="underline underline-offset-2" href={presentation.mapHref}
            >Show this character on the map</a
          >
        </dd>
      </div>
    {/if}
  </dl>
</div>
