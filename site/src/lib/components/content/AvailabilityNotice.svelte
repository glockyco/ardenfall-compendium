<script lang="ts">
  let {
    disabled,
    hiddenInQuestUi,
  }: {
    disabled: boolean;
    hiddenInQuestUi: boolean;
  } = $props();
</script>

{#if disabled || hiddenInQuestUi}
  <aside
    class="border-border bg-muted/30 mt-4 rounded-lg border p-4 text-sm"
    aria-label="Availability"
  >
    <h2 class="font-semibold">Availability</h2>
    <ul class="text-muted-foreground mt-2 grid gap-1">
      {#if disabled}
        <li>The game has this quest disabled. Other content may still reference it.</li>
      {/if}
      {#if hiddenInQuestUi}
        <li>The game marks this quest as hidden in the in-game quest log.</li>
      {/if}
    </ul>
  </aside>
{/if}
