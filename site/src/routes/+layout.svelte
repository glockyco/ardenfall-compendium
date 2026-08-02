<script lang="ts">
  import "../app.css";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import type { LayoutProps } from "./$types";

  let { children, data }: LayoutProps = $props();

  const isCurrent = (href: string): boolean =>
    page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
</script>

<a
  href="#main"
  class="bg-primary text-primary-foreground fixed top-0 left-4 z-50 -translate-y-full rounded-b-md px-3 py-2 text-sm font-medium transition-transform duration-150 ease-out focus-visible:translate-y-0"
>
  Skip to content
</a>

<div class="flex min-h-screen flex-col">
  <header class="bg-background border-border border-b">
    <div class="container mx-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-3 p-4">
      <a href={resolve("/")} class="shrink-0 text-lg font-semibold whitespace-nowrap">
        Ardenfall Compendium
      </a>
      <nav
        aria-label="Primary"
        class="text-muted-foreground flex w-full flex-wrap gap-x-4 gap-y-2 text-sm sm:w-auto sm:text-base"
      >
        {#each data.sections as section (section.id)}
          <a
            href={section.href}
            aria-current={isCurrent(section.href) ? "page" : undefined}
            class="hover:text-foreground decoration-primary aria-[current=page]:text-foreground underline-offset-8 aria-[current=page]:underline aria-[current=page]:decoration-2"
          >
            {section.label}
          </a>
        {/each}
      </nav>
    </div>
  </header>

  <main id="main" tabindex="-1" class="container mx-auto w-full flex-1 p-4">
    {@render children()}
  </main>

  <footer class="border-border mt-16 border-t">
    <div
      class="text-muted-foreground container mx-auto flex flex-wrap items-baseline gap-x-6 gap-y-1 p-4 text-sm"
    >
      {#if data.release}
        <p>
          Generated from Ardenfall
          <span class="text-foreground font-medium">{data.release.gameVersion}</span>
        </p>
        {#if data.release.snapshotDate}
          <p>
            Snapshot taken
            <time datetime={data.release.snapshotIso}>{data.release.snapshotDate}</time>
          </p>
        {/if}
        <p class="font-mono text-xs">
          {data.release.buildIdentifier} · {data.release.shortCommit}
        </p>
        {#if data.release.isFixture}
          <p class="text-primary basis-full">
            Fixture build. This data is synthetic and does not come from a real game export.
          </p>
        {/if}
      {:else}
        <p class="text-destructive">{data.releaseError}</p>
      {/if}
    </div>
  </footer>
</div>
