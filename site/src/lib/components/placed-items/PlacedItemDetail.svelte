<script lang="ts">
  import type { PlacedItemPresentationRow } from "$lib/server/read-models";

  let { presentation }: { presentation: PlacedItemPresentationRow } = $props();
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
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">Item</dt>
      <dd class="mt-1">
        {#if presentation.item && presentation.itemRoutePath}
          <a class="underline underline-offset-2" href={presentation.itemRoutePath}
            >{presentation.item.name}</a
          >
          × {presentation.stackCount}
        {:else if presentation.item}
          {presentation.item.name} × {presentation.stackCount}
        {:else}
          The item this placement carries is not in the snapshot.
        {/if}
      </dd>
    </div>
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">Condition</dt>
      <dd class="mt-1">
        {presentation.durabilityRuined
          ? "Ruined"
          : `${Math.round(presentation.durability * 100)}% durability`}
      </dd>
    </div>
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">
        Enchantments
      </dt>
      <dd class="mt-1">
        {presentation.enchantmentCount > 0
          ? `${presentation.enchantmentCount} on this copy`
          : "None"}
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
    {#if presentation.mapHref}
      <div>
        <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">Map link</dt>
        <dd class="mt-1">
          <a class="underline underline-offset-2" href={presentation.mapHref}
            >Show this item on the map</a
          >
        </dd>
      </div>
    {/if}
  </dl>
</div>
