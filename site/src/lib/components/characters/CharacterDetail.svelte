<script lang="ts">
  import type { CharacterPresentationRow } from "$lib/server/read-models";

  let { presentation }: { presentation: CharacterPresentationRow } = $props();
</script>

<div class="border-border bg-card mt-4 rounded-lg border p-5">
  <dl>
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">Name</dt>
      <dd class="mt-1">{presentation.displayName}</dd>
    </div>
  </dl>
</div>
