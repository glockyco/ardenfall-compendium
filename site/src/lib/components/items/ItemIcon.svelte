<script lang="ts">
  let {
    src,
    alt = "",
    size = "md",
    displayIconColor = null,
  }: {
    src: string | null;
    alt?: string;
    size?: "sm" | "md" | "lg";
    displayIconColor?: string | null;
  } = $props();

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

  function tint(jsonColor: string | null): string | null {
    if (!jsonColor) return null;
    try {
      const c = JSON.parse(jsonColor) as { r?: unknown; g?: unknown; b?: unknown };
      if (typeof c.r !== "number" || typeof c.g !== "number" || typeof c.b !== "number") {
        return null;
      }
      const toHex = (n: number) =>
        Math.round(Math.max(0, Math.min(1, n)) * 255)
          .toString(16)
          .padStart(2, "0");
      return `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`;
    } catch {
      return null;
    }
  }

  const tintHex = $derived(tint(displayIconColor));
  const isWhite = $derived(tintHex === "#ffffff");
</script>

<span
  class={`item-icon bg-muted border-border flex shrink-0 items-center justify-center rounded border ${shell[size]}`}
  aria-hidden={alt.length === 0}
>
  {#if src}
    {#if tintHex && !isWhite}
      <span
        class={`relative ${image[size]}`}
        style:background-color={tintHex}
        style:mask-image={`url(${src})`}
        style:-webkit-mask-image={`url(${src})`}
        style:mask-size="contain"
        style:-webkit-mask-size="contain"
        style:mask-repeat="no-repeat"
        style:-webkit-mask-repeat="no-repeat"
        style:mask-position="center"
        style:-webkit-mask-position="center"
        aria-hidden="true"
      ></span>
    {:else}
      <img class={`object-contain ${image[size]}`} {src} {alt} loading="lazy" decoding="async" />
    {/if}
  {/if}
</span>
