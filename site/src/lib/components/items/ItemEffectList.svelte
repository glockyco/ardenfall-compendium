<script lang="ts">
  import RichText from "$lib/components/content/RichText.svelte";
  import type { ItemPresentationEffect, RichTextDocument } from "$lib/server/read-models";

  let { effects, source }: { effects: ItemPresentationEffect[]; source: RichTextDocument } =
    $props();
</script>

{#if source.nodes.length > 0 || effects.length > 0}
  <section class="border-border rounded-lg border p-4">
    <h2 class="font-semibold">Effects</h2>
    {#if source.nodes.length > 0}
      <p class="text-muted-foreground mt-2 text-sm"><RichText richText={source} /></p>
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
