<script lang="ts">
  let {
    src,
    alt = "",
    size = "md",
  }: { src: string | null; alt?: string; size?: "sm" | "md" | "lg" } = $props();

  const shell = {
    sm: "size-8",
    md: "size-12",
    lg: "size-16",
  };
  const image = {
    sm: "size-6",
    md: "size-10",
    lg: "size-14",
  };
</script>

<span
  class={`item-icon bg-muted border-border flex shrink-0 items-center justify-center rounded border ${shell[size]}`}
  aria-hidden={alt.length === 0}
>
  {#if src}
    <img class={`object-contain ${image[size]}`} {src} {alt} loading="lazy" decoding="async" />
  {/if}
</span>
