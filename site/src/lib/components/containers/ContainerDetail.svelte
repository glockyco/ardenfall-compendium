<script lang="ts">
  import type { ContainerPresentationRow } from "$lib/server/read-models";

  let { presentation }: { presentation: ContainerPresentationRow } = $props();
  const number = (value: number | null): string =>
    value === null
      ? "No coordinate is available."
      : Number.isInteger(value)
        ? `${value}`
        : value.toFixed(2);
  // The authored lock, not a prediction about whether a player can open it.
  const lockText = (row: ContainerPresentationRow): string =>
    row.lockMode === "Unlocked"
      ? "Unlocked"
      : `${row.lockMode}, authored difficulty ${row.lockLevel}` +
        (row.allowLockpick ? ", lockpicking allowed" : ", lockpicking refused");
</script>

<div class="border-border bg-card mt-4 rounded-lg border p-5">
  <dl class="grid gap-4 sm:grid-cols-2">
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">Lock</dt>
      <dd class="mt-1">{lockText(presentation)}</dd>
    </div>
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">Level</dt>
      <dd class="mt-1">
        {presentation.levelAutomatic
          ? "Scales with the area"
          : `Fixed at ${presentation.levelValue}`}
      </dd>
    </div>
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">Loot</dt>
      <dd class="mt-1">
        {presentation.additionalCount} held outright, {presentation.possibleItemCount} reachable through
        {presentation.lootListCount}
        {presentation.lootListCount === 1 ? "list" : "lists"}
      </dd>
    </div>
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">Interaction</dt>
      <dd class="mt-1">{presentation.interactionText}</dd>
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
            >Show this container on the map</a
          >
        </dd>
      </div>
    {/if}
  </dl>
</div>
