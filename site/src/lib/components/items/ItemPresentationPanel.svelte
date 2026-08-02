<script lang="ts">
  import RichText from "$lib/components/content/RichText.svelte";
  import ItemEffectList from "./ItemEffectList.svelte";
  import { itemDiagnosticMessage } from "./itemDiagnostic";
  import ItemRequirementList from "./ItemRequirementList.svelte";
  import ItemStatBlock from "./ItemStatBlock.svelte";
  import ItemStateFacts from "./ItemStateFacts.svelte";
  import type { ItemPresentationRow } from "$lib/server/read-models";

  let { item }: { item: ItemPresentationRow } = $props();
</script>

<div class="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
  {#if item.omissions.length > 0 || item.diagnostics.length > 0}
    <section class="border-border bg-muted/30 rounded-lg border p-4 lg:col-span-2">
      <h2 class="font-semibold">Not shown here</h2>
      <ul class="text-muted-foreground mt-2 grid gap-1 text-sm">
        {#each item.omissions as omission (`omission-${omission.code}-${omission.message}`)}
          <li>{omission.message}</li>
        {/each}
        {#each item.diagnostics as diagnostic (`diagnostic-${diagnostic.code}-${diagnostic.field}-${diagnostic.message}`)}
          <li>
            {itemDiagnosticMessage(diagnostic)}
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if item.description.nodes.length > 0}
    <section class="border-border rounded-lg border p-4">
      <h2 class="font-semibold">Description</h2>
      <p class="mt-3 leading-7">
        <RichText richText={item.description} />
      </p>
    </section>
  {/if}

  <div class="grid gap-4">
    <ItemStatBlock rows={item.statRows} />
    <ItemRequirementList requirements={item.requirements} />
    <ItemEffectList
      effects={item.effects}
      source={item.effectsSourceRichText}
      diagnostics={item.diagnostics}
    />
    <ItemStateFacts facts={item.stateFacts} durability={item.durability} />
  </div>
</div>
