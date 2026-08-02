<script lang="ts">
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Status Effects | Ardenfall Compendium</title>
  <meta
    name="description"
    content={`Browse ${data.statusEffects.length} status effects grouped by hostility in the Ardenfall Compendium.`}
  />
  <link rel="canonical" href={data.statusEffectRoute} />
  <meta property="og:title" content="Status Effects | Ardenfall Compendium" />
  <meta
    property="og:description"
    content={`Browse ${data.statusEffects.length} status effects grouped by hostility in the Ardenfall Compendium.`}
  />
  <meta property="og:url" content={data.statusEffectRoute} />
  <meta property="og:type" content="website" />
</svelte:head>

<h1 class="text-2xl font-bold">Status Effects</h1>
<p class="text-muted-foreground mt-2">
  {data.statusEffects.length} deterministic status-effect records.
</p>

{#if data.statusEffects.length > 0}
  <nav class="mt-6" aria-label="Status effect groups">
    <p class="text-muted-foreground text-sm">Jump to a group:</p>
    <ul class="mt-2 flex flex-wrap gap-x-4 gap-y-2">
      {#each data.groups as group (group.id)}
        {#if group.rows.length > 0}
          <li><a class="underline underline-offset-2" href={`#${group.id}`}>{group.label}</a></li>
        {/if}
      {/each}
    </ul>
  </nav>
  {#each data.groups as group (group.id)}
    {#if group.rows.length > 0}
      <section class="mt-8" id={group.id}>
        <h2 class="text-xl font-semibold">{group.label}</h2>
        <ul class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {#each group.rows as statusEffect (statusEffect.id)}
            <li class="border-border bg-card rounded-lg border p-4">
              <a class="block underline-offset-4 hover:underline" href={statusEffect.routePath}>
                <span class="block font-medium">{statusEffect.displayName}</span>
                <span class="text-muted-foreground mt-1 block text-sm">
                  {statusEffect.descriptionSummary ?? "No description available"}
                </span>
              </a>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  {/each}
{:else}
  <p class="text-muted-foreground mt-4">No status effects found.</p>
{/if}
