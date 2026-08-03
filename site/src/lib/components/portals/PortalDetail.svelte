<script lang="ts">
  import type { PortalPresentationRow } from "$lib/server/read-models";

  let { presentation }: { presentation: PortalPresentationRow } = $props();
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
  </dl>

  <section class="mt-6" aria-labelledby="portal-connection">
    <h2 id="portal-connection" class="font-semibold">Connected portal</h2>
    {#if presentation.connectedPortal}
      <p class="mt-2">
        <a class="underline underline-offset-2" href={presentation.connectedPortal.routePath}>
          {presentation.connectedPortal.label}
        </a>
      </p>
    {:else}
      <p class="text-muted-foreground mt-2">No connected portal is recorded.</p>
    {/if}
  </section>
</div>
