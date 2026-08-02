<script lang="ts">
  import RichText from "$lib/components/content/RichText.svelte";
  import type {
    ItemPresentationDiagnostic,
    ItemPresentationEffect,
    RichTextDocument,
  } from "$lib/server/read-models";
  import { itemDiagnosticMessage } from "./itemDiagnostic";

  let {
    effects,
    source,
    diagnostics,
  }: {
    effects: ItemPresentationEffect[];
    source: RichTextDocument;
    diagnostics: ItemPresentationDiagnostic[];
  } = $props();

  const unresolvedEffectDiagnostic = $derived(
    diagnostics.find((diagnostic) => diagnostic.code === "unresolvedEffectTarget"),
  );
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
            {#if effect.targetId === null}
              <span class="text-muted-foreground block text-xs">
                No link available.
                {#if unresolvedEffectDiagnostic}
                  {itemDiagnosticMessage(unresolvedEffectDiagnostic)}
                {:else}
                  This effect names a status effect that this snapshot does not publish as its own
                  page.
                {/if}
              </span>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>
{/if}
