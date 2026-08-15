<script lang="ts">
  import type { AvailabilityFlag } from "./availability-flags";

  let { flags }: { flags: AvailabilityFlag[] } = $props();
</script>

{#if flags.length > 0}
  <aside
    class="border-border bg-muted/30 mt-4 rounded-lg border p-4 text-sm"
    aria-label="Availability"
  >
    <h2 class="font-semibold">Availability</h2>
    <ul class="text-muted-foreground mt-2 grid gap-1">
      {#each flags as flag (flag.kind)}
        <li>
          {#if flag.kind === "disabled"}
            The game has this {flag.subject} disabled. Other content may still reference it.
          {:else if flag.kind === "hidden-in-quest-ui"}
            The game marks this {flag.subject} as hidden in the in-game quest log.
          {:else if flag.kind === "debug-only"}
            The game shows this {flag.subject} only in a debug build.
          {/if}
        </li>
      {/each}
    </ul>
  </aside>
{/if}
