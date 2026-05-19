<script lang="ts">
  import type { ItemPresentationStatRow } from "$lib/server/read-models";

  let { row }: { row: ItemPresentationStatRow } = $props();
</script>

<div
  class="flex items-baseline justify-between gap-4 text-sm"
  style:padding-left={`${row.indent}rem`}
>
  <dt class="text-muted-foreground">{row.label}</dt>
  <dd class={row.size === "large" ? "text-base font-semibold" : "font-medium"}>
    {row.valueText}{row.suffix ?? ""}
  </dd>
</div>
