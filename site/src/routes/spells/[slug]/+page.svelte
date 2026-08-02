<script lang="ts">
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const spell = $derived(data.presentation);
</script>

<svelte:head>
  <title>{spell.name} | Spells | Ardenfall Compendium</title>
</svelte:head>

<a class="text-sm underline" href="/spells">← back to spells</a>
<h1 class="mt-2 text-2xl font-bold">{spell.name}</h1>

<div class="border-border bg-card mt-4 rounded-lg border p-5">
  <dl class="grid gap-4 sm:grid-cols-2">
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">School</dt>
      <dd class="mt-1">
        {#if spell.school && spell.schoolRoutePath}
          <a class="underline underline-offset-2" href={spell.schoolRoutePath}>{spell.school}</a>
        {:else}
          {spell.school ?? "No school"}
        {/if}
      </dd>
    </div>
    <div>
      <dt class="text-muted-foreground text-sm font-medium tracking-wide uppercase">Mana cost</dt>
      <dd class="mt-1">
        {spell.manaCost === null ? "Unavailable" : `${spell.manaCost} mana`}
      </dd>
    </div>
  </dl>

  {#if spell.isIllegal}
    <p class="text-muted-foreground mt-6 text-sm">Illegal spell</p>
  {/if}
</div>
