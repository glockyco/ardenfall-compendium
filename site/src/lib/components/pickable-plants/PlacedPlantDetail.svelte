<script lang="ts">
  import type { PlacedPlantPresentationRow } from "$lib/server/read-models";

  let { presentation }: { presentation: PlacedPlantPresentationRow } = $props();
  const number = (value: number | null): string =>
    value === null
      ? "No coordinate is available."
      : Number.isInteger(value)
        ? `${value}`
        : value.toFixed(2);
</script>

<div class="border-border bg-card mt-4 rounded-lg border p-5">
  <dl class="grid gap-4 sm:grid-cols-2">
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">Yields</dt>
      <dd class="mt-1">
        {#if presentation.item && presentation.itemRoutePath}
          <a class="underline underline-offset-2" href={presentation.itemRoutePath}
            >{presentation.item.name}</a
          >
          × {presentation.itemCount}
        {:else if presentation.item}
          {presentation.item.name} × {presentation.itemCount}
        {:else}
          The item this plant yields is not in the snapshot.
        {/if}
      </dd>
    </div>
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">
        Harvest experience
      </dt>
      <dd class="mt-1">
        {presentation.harvestXp > 0 ? `${presentation.harvestXp} XP` : "None"}
      </dd>
    </div>
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">Regrows</dt>
      <dd class="mt-1">
        {presentation.regrowDays > 0
          ? `After ${presentation.regrowDays} ${presentation.regrowDays === 1 ? "day" : "days"}`
          : "Never"}
      </dd>
    </div>
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">Cell</dt>
      <dd class="mt-1">{presentation.cell}</dd>
    </div>
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">Coordinates</dt>
      <dd class="mt-1">{number(presentation.mapX)}, {number(presentation.mapY)}</dd>
    </div>
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">Interaction</dt>
      <dd class="mt-1">{presentation.interactionText}</dd>
    </div>
    {#if presentation.mapHref}
      <div>
        <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">Map link</dt>
        <dd class="mt-1">
          <a class="underline underline-offset-2" href={presentation.mapHref}
            >Show this plant on the map</a
          >
        </dd>
      </div>
    {/if}
  </dl>
</div>
