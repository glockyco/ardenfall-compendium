<script lang="ts">
  import type { RelationshipEdge } from "$lib/server/read-models";

  let { edge }: { edge: RelationshipEdge } = $props();
</script>

{#if edge.targetLabel !== null}
  {#if edge.targetRoutePath !== null && edge.targetHasPage !== false}
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- graph route paths are generated from the static read model -->
    <a class="underline underline-offset-2" href={edge.targetRoutePath}>{edge.targetLabel}</a>
  {:else}
    {edge.targetLabel}
  {/if}
{/if}
