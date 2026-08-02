<script lang="ts">
  import type { StatTypePresentationRow } from "$lib/server/read-models";

  let { presentation }: { presentation: StatTypePresentationRow } = $props();
</script>

<div class="border-border bg-card mt-4 rounded-lg border p-5">
  <div class="flex items-center gap-3">
    <span
      class="border-border bg-muted flex size-12 items-center justify-center rounded border"
      style:background-color={presentation.iconColor ?? undefined}
      aria-hidden="true"
    >
      {#if presentation.iconSrc}
        <img
          class="size-10 object-contain"
          src={presentation.iconSrc}
          alt=""
          loading="lazy"
          decoding="async"
        />
      {/if}
    </span>
    <p class="text-muted-foreground text-sm font-medium tracking-wide uppercase">
      {presentation.grouping}
    </p>
  </div>

  <!-- The game shows the long description where it has one and falls back to the
       short one, so leading with the short text inverts its own priority and can
       print near-identical prose twice. -->
  {#if presentation.longDescription}
    <p class="mt-4">{presentation.longDescription}</p>
  {:else if presentation.description}
    <p class="mt-4">{presentation.description}</p>
  {/if}

  {#if presentation.affects.length > 0}
    <section class="mt-6">
      <h2 class="text-lg font-semibold">Affects</h2>
      <ul class="mt-2 list-disc space-y-1 pl-6">
        {#each presentation.affects as reference (`${reference.label}:${reference.routePath ?? "unresolved"}`)}
          <li>
            {#if reference.routePath}
              <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- stat routes are generated from the static read model -->
              <a class="underline underline-offset-2" href={reference.routePath}
                >{reference.label}</a
              >
            {:else}
              {reference.label}
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if presentation.skillAffects.length > 0}
    <section class="mt-6">
      <h2 class="text-lg font-semibold">Skill affects</h2>
      <ul class="mt-2 list-disc space-y-1 pl-6">
        {#each presentation.skillAffects as reference (`${reference.label}:${reference.routePath ?? "unresolved"}`)}
          <li>
            {#if reference.routePath}
              <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- stat routes are generated from the static read model -->
              <a class="underline underline-offset-2" href={reference.routePath}
                >{reference.label}</a
              >
            {:else}
              {reference.label}
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</div>
