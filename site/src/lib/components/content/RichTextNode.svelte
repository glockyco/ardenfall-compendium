<script lang="ts">
  import RichTextNode from "./RichTextNode.svelte";
  import type { RichTextNode as Node } from "$lib/server/read-models";

  let { node }: { node: Node } = $props();
</script>

{#if node.type === "text"}
  {node.text}
{:else if node.type === "lineBreak"}
  <br />
{:else if node.type === "strong"}
  <strong>
    {#each node.children as child, index (`strong-${index}`)}
      <RichTextNode node={child} />
    {/each}
  </strong>
{:else if node.type === "emphasis"}
  <em>
    {#each node.children as child, index (`emphasis-${index}`)}
      <RichTextNode node={child} />
    {/each}
  </em>
{:else if node.type === "strike"}
  <s>
    {#each node.children as child, index (`strike-${index}`)}
      <RichTextNode node={child} />
    {/each}
  </s>
{:else if node.type === "color"}
  <span
    class:rich-token-positive={node.token === "positive"}
    class:rich-token-negative={node.token === "negative"}
    style:color={node.color ?? undefined}
  >
    {#each node.children as child, index (`color-${index}`)}
      <RichTextNode node={child} />
    {/each}
  </span>
{:else if node.type === "sprite"}
  <span class="text-muted-foreground rounded border px-1 text-[0.75em]">{node.name}</span>
{:else if node.type === "termLink"}
  {#if node.targetRoutePath}
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- graph route paths are generated from the static read model -->
    <a class="underline decoration-dotted underline-offset-2" href={node.targetRoutePath}
      >{node.label}</a
    >
  {:else}
    <span
      class="text-muted-foreground"
      title="No compendium page is available for this term."
      aria-label={`${node.label} (no compendium page is available)`}>{node.label}</span
    >
  {/if}
{/if}
