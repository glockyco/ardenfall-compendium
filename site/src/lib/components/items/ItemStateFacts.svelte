<script lang="ts">
  import type {
    ItemPresentationDurability,
    ItemPresentationStateFact,
  } from "$lib/server/read-models";

  let {
    facts,
    durability,
  }: { facts: ItemPresentationStateFact[]; durability: ItemPresentationDurability | null } =
    $props();
</script>

{#if facts.length > 0 || durability}
  <section class="border-border rounded-lg border p-4">
    <h2 class="font-semibold">State</h2>
    <ul class="mt-3 grid gap-2 text-sm">
      {#if durability}
        <li class="flex justify-between gap-4">
          <span class="text-muted-foreground">Durability</span>
          <span class="font-medium">{durability.max}</span>
        </li>
      {/if}
      {#each facts as fact (fact.kind)}
        <li>
          <span class="font-medium">{fact.label}</span>
          <p class="text-muted-foreground">{fact.description}</p>
        </li>
      {/each}
    </ul>
  </section>
{/if}
