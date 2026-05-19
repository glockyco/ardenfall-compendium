<script lang="ts">
  import RichTextNode from "./RichTextNode.svelte";
  import type { RichTextDocument } from "$lib/server/read-models";

  let { richText }: { richText: RichTextDocument } = $props();
</script>

<span class="rich-text">
  {#each richText.nodes as node, index (`node-${index}`)}
    <RichTextNode {node} />
  {/each}
</span>
