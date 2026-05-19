<script lang="ts">
  import RelatedEntityCard from "./RelatedEntityCard.svelte";
  import type { RelationshipSection } from "$lib/server/read-models";

  let { section }: { section: RelationshipSection } = $props();
</script>

{#if section.edges.length > 0}
  <section class="border-border rounded-lg border p-4">
    <h2 class="font-semibold">{section.title}</h2>
    <ul class="mt-3 grid gap-2 sm:grid-cols-2">
      {#each section.edges as edge (`${edge.predicate}:${edge.targetType}:${edge.targetId}`)}
        <RelatedEntityCard {edge} />
      {/each}
    </ul>
  </section>
{/if}
