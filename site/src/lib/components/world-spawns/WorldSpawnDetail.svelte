<script lang="ts">
  import type { WorldSpawnPresentationRow } from "$lib/server/read-models";

  let { presentation }: { presentation: WorldSpawnPresentationRow } = $props();
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
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">Mechanism</dt>
      <dd class="mt-1">
        {presentation.kind === "local"
          ? "The scene spawns a character definition here"
          : "The scene places a character the record table carries"}
      </dd>
    </div>
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">Character</dt>
      <dd class="mt-1">
        {#if presentation.target && presentation.targetRoutePath}
          <a class="underline underline-offset-2" href={presentation.targetRoutePath}
            >{presentation.target.name}</a
          >
        {:else if presentation.target}
          {presentation.target.name}
        {:else}
          The character this spawner references is not in the snapshot.
        {/if}
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
            >Show this spawn on the map</a
          >
        </dd>
      </div>
    {/if}
  </dl>
</div>
