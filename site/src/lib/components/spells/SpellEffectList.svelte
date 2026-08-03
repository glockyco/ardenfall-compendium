<script lang="ts">
  import type { SpellPresentationEffect } from "$lib/server/entities/spell";
  import { spellEffectLabel } from "./spellEffect";

  let { effects }: { effects: SpellPresentationEffect[] } = $props();

  const statusEffectKind = (kind: string): boolean =>
    kind === "apply-status-to-self" || kind === "apply-status-to-target";
</script>

<section class="border-border rounded-lg border p-4">
  <h2 class="font-semibold">Effects</h2>
  <p class="text-muted-foreground mt-2 text-sm">
    Values are level 1 samples. Spell level depends on Intelligence and the governing skill.
  </p>

  {#if effects.length === 0}
    <p class="text-muted-foreground mt-3 text-sm">No effects are recorded for this spell.</p>
  {:else}
    <ul class="mt-3 grid gap-3 text-sm">
      {#each effects as effect, index (`${effect.kind}-${effect.statusEffectId ?? "none"}-${index}`)}
        <li>
          {#if statusEffectKind(effect.kind)}
            <!--
              A status effect line names the effect and who it lands on, so the generic kind
              sentence would state the target twice. The specific line carries the meaning.
            -->
            <p>
              {#if effect.statusEffectId !== null && effect.statusEffectLabel !== null && effect.statusEffectRoutePath !== null}
                <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- route paths come from the static read model -->
                <a
                  class="font-medium underline underline-offset-2"
                  href={effect.statusEffectRoutePath}
                >
                  {effect.statusEffectLabel}
                </a>
              {:else}
                <span class="text-muted-foreground">Status effect name unavailable.</span>
              {/if}
              {effect.appliesToSelf ? " affects the caster" : " affects a target"}.
            </p>
            {#if effect.sampleLevel !== null}
              <p class="text-muted-foreground mt-1 text-xs">Sample level: {effect.sampleLevel}</p>
            {/if}
            {#if effect.sampleLifetimeSeconds !== null}
              <p class="text-muted-foreground text-xs">
                Lifetime: {effect.sampleLifetimeSeconds} seconds
              </p>
            {/if}
          {:else}
            <p class="font-medium">{spellEffectLabel(effect.kind)}.</p>
            {#if effect.damage !== null}
              <p class="text-muted-foreground mt-1 text-xs">
                Damage: {effect.damage}{effect.damageType ? ` (${effect.damageType})` : ""}
              </p>
            {/if}
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>
