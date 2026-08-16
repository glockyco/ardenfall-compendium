<script lang="ts">
  import type { CharacterPresentationRow } from "$lib/server/read-models";

  let { presentation }: { presentation: CharacterPresentationRow } = $props();
  const number = (value: number): string =>
    Number.isInteger(value) ? `${value}` : value.toFixed(2);
  const valueLabels = {
    stock: "stock",
    drops: "drops",
    factions: "factions",
    level: "level",
  } as const;
</script>

<div class="border-border bg-card mt-4 rounded-lg border p-5">
  <dl class="grid gap-4 sm:grid-cols-2">
    {#if presentation.displayNameProvenance === "absent"}
      <div>
        <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">
          Name source
        </dt>
        <dd class="mt-1">
          {#if presentation.characterType}
            The game has no authored name for this character and generates one when it spawns from
            the vocabulary of its race.
          {:else}
            The game has no authored name for this character and no race vocabulary to generate one.
          {/if}
        </dd>
      </div>
    {/if}
    {#each presentation.valueProvenance as value (value.name)}
      <div>
        <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">
          {valueLabels[value.name]} source
        </dt>
        <dd class="mt-1">
          {#if value.provenance === "own"}
            This character has its own {valueLabels[value.name]}.
          {:else if value.provenance === "inherited"}
            This character inherits its {valueLabels[value.name]} from its type{#if value.owner},
              {value.owner}{/if}.
          {:else}
            The game configures no {valueLabels[value.name]} for this character.
          {/if}
        </dd>
      </div>
    {/each}
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
