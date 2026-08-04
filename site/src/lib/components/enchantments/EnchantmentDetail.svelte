<script lang="ts">
  import type { EnchantmentPresentationRow } from "$lib/server/entities/enchantment";

  let { enchantment }: { enchantment: EnchantmentPresentationRow } = $props();
</script>

<div class="mt-4 grid gap-6">
  <section class="border-border bg-card rounded-lg border p-5">
    <h2 class="font-semibold">Can enchant</h2>
    {#if enchantment.appliesToItemRefs.length === 0}
      <p class="text-muted-foreground mt-3 text-sm">
        This enchantment has no item filter and can be applied to any item.
      </p>
    {:else}
      <ul class="mt-3 grid gap-2 sm:grid-cols-2">
        {#each enchantment.appliesToItemRefs as item (item.itemId)}
          <li>
            {#if item.itemRoutePath}
              <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- route paths come from the static read model -->
              <a class="underline underline-offset-2" href={item.itemRoutePath}>{item.itemLabel}</a>
            {:else}
              <span>{item.itemLabel}</span>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="border-border bg-card rounded-lg border p-5">
    <h2 class="font-semibold">Effects</h2>
    {#if enchantment.effects.length === 0}
      <p class="text-muted-foreground mt-3 text-sm">This enchantment has no recorded effects.</p>
    {:else}
      <ul class="mt-3 grid gap-3 text-sm">
        {#each enchantment.effects as effect (effect.ordinal)}
          <li>
            {#if effect.statusEffectId !== null && effect.statusEffectLabel !== null}
              <p>
                Applies
                {#if effect.statusEffectRoutePath}
                  <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- route paths come from the static read model -->
                  <a
                    class="font-medium underline underline-offset-2"
                    href={effect.statusEffectRoutePath}>{effect.statusEffectLabel}</a
                  >
                {:else}
                  <span class="font-medium">{effect.statusEffectLabel}</span>
                {/if}
                .
              </p>
            {:else}
              <p class="font-medium">{effect.kind} is present, but its detail was not extracted.</p>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>
