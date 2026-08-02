<script lang="ts">
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Status Effects | Ardenfall Compendium</title>
</svelte:head>

<h1 class="text-2xl font-bold">Status Effects</h1>
<p class="text-muted-foreground mt-2">
  {data.statusEffects.length} deterministic status-effect records.
</p>

{#if data.statusEffects.length > 0}
  <section class="mt-8">
    <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {#each data.statusEffects as statusEffect (statusEffect.id)}
        <li class="border-border bg-card rounded-lg border p-4">
          <a class="block underline-offset-4 hover:underline" href={statusEffect.routePath}>
            <span class="block font-medium">{statusEffect.name ?? "Unnamed status effect"}</span>
            <span class="text-muted-foreground mt-1 block text-sm">
              {statusEffect.isHostile ? "Hostile" : "Not hostile"}
            </span>
          </a>
        </li>
      {/each}
    </ul>
  </section>
{:else}
  <p class="text-muted-foreground mt-4">No status effects found.</p>
{/if}
