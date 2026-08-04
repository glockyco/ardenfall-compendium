<script lang="ts">
  import RichText from "$lib/components/content/RichText.svelte";
  import type { EnchantmentPresentationRow } from "$lib/server/entities/enchantment";

  let { enchantment }: { enchantment: EnchantmentPresentationRow } = $props();
</script>

<div class="mt-4 grid gap-6">
  <section class="border-border bg-card rounded-lg border p-5">
    <h2 class="font-semibold">Effects</h2>
    {#if enchantment.description && enchantment.description.nodes.length > 0}
      <p class="text-muted-foreground mt-2 text-sm">
        <RichText richText={enchantment.description} />
      </p>
    {/if}
    {#if enchantment.effects.length === 0}
      <p class="text-muted-foreground mt-3 text-sm">This enchantment has no recorded effects.</p>
    {:else}
      <ul class="mt-3 grid gap-3 text-sm">
        {#each enchantment.effects as effect (effect.ordinal)}
          {#if (effect.description !== null && effect.description.nodes.length > 0) || (effect.statusEffectId !== null && effect.statusEffectLabel !== null)}
            <li>
              {#if effect.description && effect.description.nodes.length > 0}
                <p><RichText richText={effect.description} /></p>
              {/if}
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
              {/if}
            </li>
          {/if}
        {/each}
      </ul>
    {/if}
  </section>
</div>
