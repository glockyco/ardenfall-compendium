<script lang="ts">
  import RichText from "$lib/components/content/RichText.svelte";
  import ItemEffectList from "./ItemEffectList.svelte";
  import ItemRequirementList from "./ItemRequirementList.svelte";
  import ItemStatBlock from "./ItemStatBlock.svelte";
  import ItemStateFacts from "./ItemStateFacts.svelte";
  import type { ItemPresentationRow } from "$lib/server/read-models";

  let { item }: { item: ItemPresentationRow } = $props();
</script>

<div class="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
  <section class="border-border rounded-lg border p-4">
    <h2 class="font-semibold">Description</h2>
    <p class="mt-3 leading-7">
      <RichText richText={item.description} />
    </p>
  </section>

  <div class="grid gap-4">
    <ItemStatBlock rows={item.statRows} />
    <ItemRequirementList requirements={item.requirements} />
    <ItemEffectList effects={item.effects} source={item.effectsSource} />
    <ItemStateFacts facts={item.stateFacts} durability={item.durability} />
  </div>
</div>
