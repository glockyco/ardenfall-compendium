<script lang="ts">
  import ItemIcon from "./items/ItemIcon.svelte";

  let { title, iconSrc }: { title: string; iconSrc: string | null } = $props();
</script>

<header class="mt-2 flex items-center gap-3">
  {#if iconSrc}
    <ItemIcon src={iconSrc} size="lg" />
  {/if}
  <h1 class="text-2xl font-bold">{title}</h1>
</header>
