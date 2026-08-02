<script lang="ts">
  import EntityLink from "./EntityLink.svelte";
  import type { RelationshipEdge } from "$lib/server/read-models";

  let { edge }: { edge: RelationshipEdge } = $props();
</script>

<li class="border-border rounded-md border p-3 text-sm">
  <EntityLink {edge} />
</li>
