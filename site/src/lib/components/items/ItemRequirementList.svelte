<script lang="ts">
  import type { ItemPresentationRequirement } from "$lib/server/read-models";

  let { requirements }: { requirements: ItemPresentationRequirement[] } = $props();
</script>

{#if requirements.length > 0}
  <section class="border-border rounded-lg border p-4">
    <h2 class="font-semibold">Minimum stat</h2>
    <p class="text-muted-foreground mt-1 text-sm">Below this stat, the item is less effective.</p>
    <ul class="mt-3 grid gap-2 text-sm">
      {#each requirements as requirement (requirement.id)}
        <li class="flex justify-between gap-4">
          <span class="text-muted-foreground">{requirement.label}</span>
          <span class="font-medium">{requirement.valueText}</span>
        </li>
      {/each}
    </ul>
  </section>
{/if}
