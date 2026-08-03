<script lang="ts">
  import type { CharacterPresentationRow } from "$lib/server/read-models";

  let { presentation }: { presentation: CharacterPresentationRow } = $props();
</script>

<div class="border-border bg-card mt-4 rounded-lg border p-5">
  <dl>
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">Name</dt>
      <dd class="mt-1">{presentation.displayName}</dd>
    </div>
  </dl>

  <section class="border-border mt-6 border-t pt-5">
    <h2 class="font-semibold">Drops</h2>
    {#if presentation.drops.length > 0}
      <ul class="mt-3 grid gap-2 sm:grid-cols-2">
        {#each presentation.drops as drop, index (`${drop.label}-${drop.routePath ?? "text"}-${index}`)}
          <li>
            {#if drop.routePath}
              <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- route paths come from the static read model -->
              <a class="underline underline-offset-2" href={drop.routePath}>{drop.label}</a>
            {:else}
              {drop.label}
            {/if}
          </li>
        {/each}
      </ul>
    {:else}
      <p class="text-muted-foreground mt-2">No drops are recorded for this character.</p>
    {/if}
  </section>
</div>
