<script lang="ts">
  import RichTextNode from "./RichTextNode.svelte";
  import type { RichTextDocument } from "#lib/server/read-models.js";

  let { richText }: { richText: RichTextDocument } = $props();
</script>

<span class="rich-text">
  {#each richText.nodes as node, index (`node-${index}`)}
    <RichTextNode {node} />
  {/each}
</span>
