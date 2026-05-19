<script lang="ts">
  import type { ItemPresentationEffect } from "$lib/server/read-models";

  let { effects, source }: { effects: ItemPresentationEffect[]; source: string } = $props();
</script>

{#if source || effects.length > 0}
  <section class="border-border rounded-lg border p-4">
    <h2 class="font-semibold">Effects</h2>
    {#if source}
      <p class="text-muted-foreground mt-2 text-sm">{source}</p>
    {/if}
    {#if effects.length > 0}
      <ul class="mt-3 grid gap-2 text-sm">
        {#each effects as effect, index (`${effect.kind}-${effect.label}-${index}`)}
          <li>
            <span class="font-medium">{effect.label}</span>
            <span class="text-muted-foreground">{effect.kind}</span>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
{/if}
