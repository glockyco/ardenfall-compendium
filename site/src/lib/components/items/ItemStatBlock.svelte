<script lang="ts">
  import ItemStatRow from "./ItemStatRow.svelte";
  import type { ItemPresentationStatRow } from "$lib/server/read-models";

  let { rows }: { rows: ItemPresentationStatRow[] } = $props();
</script>

{#if rows.length > 0}
  <section class="border-border rounded-lg border p-4">
    <h2 class="font-semibold">Stats</h2>
    <dl class="mt-3 grid gap-2">
      {#each rows as row (row.id)}
        <ItemStatRow {row} />
      {/each}
    </dl>
  </section>
{/if}
