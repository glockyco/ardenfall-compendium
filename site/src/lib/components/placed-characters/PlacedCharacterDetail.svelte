<script lang="ts">
  import type { PlacedCharacterPresentationRow } from "$lib/server/read-models";

  let { presentation }: { presentation: PlacedCharacterPresentationRow } = $props();
  const number = (value: number): string =>
    Number.isInteger(value) ? `${value}` : value.toFixed(2);
</script>

<div class="border-border bg-card mt-4 rounded-lg border p-5">
  <dl class="grid gap-4 sm:grid-cols-2">
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">
        Character type
      </dt>
      <dd class="mt-1">
        {#if presentation.characterType}
          {#if presentation.characterType.routePath}
            <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- route paths are generated from the static read model -->
            <a class="underline underline-offset-2" href={presentation.characterType.routePath}>
              {presentation.characterType.label}
            </a>
          {:else}
            {presentation.characterType.label}
          {/if}
          {#if presentation.displayNameProvenance === "inherited"}
            <span class="text-muted-foreground"> (This name comes from the character type.)</span>
          {/if}
        {:else}
          No character type could be resolved.
        {/if}
      </dd>
    </div>
    {#if presentation.displayNameProvenance === "absent"}
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
