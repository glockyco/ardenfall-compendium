<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { Button } from "$lib/components/ui/button/index.js";

  const isNotFound = $derived(page.status === 404);
  // Every route throws its own "<thing> not found" message, so on a 404 the
  // message is already the right heading. Other statuses get a stable heading
  // and show the raw message separately, because it is rarely presentable.
  const heading = $derived(
    isNotFound ? (page.error?.message ?? "Page not found") : "Something went wrong",
  );
</script>

<svelte:head>
  <title>{heading} · Ardenfall Compendium</title>
</svelte:head>

<section class="mx-auto flex max-w-md flex-col items-start gap-4 px-6 py-16">
  <p class="text-muted-foreground text-sm tracking-widest uppercase">Error {page.status}</p>
  <h1 class="text-3xl font-semibold">{heading}</h1>
  <p class="text-muted-foreground">
    {#if isNotFound}
      This page is not in the current snapshot. It may have been removed in a later game patch, or
      it may never have existed. The sections in the header list everything this build covers.
    {:else}
      An unexpected error occurred while loading this page. Reloading may resolve it. If it does
      not, share the error message shown here when reporting the issue.
    {/if}
  </p>
  {#if !isNotFound && page.error?.message}
    <p class="bg-muted text-muted-foreground rounded-md px-3 py-2 text-sm break-words">
      {page.error.message}
    </p>
  {/if}
  <div class="flex gap-2">
    <Button href={resolve("/")}>Back to home</Button>
    {#if !isNotFound}
      <Button variant="outline" href={page.url.pathname + page.url.search}>Reload</Button>
    {/if}
  </div>
</section>
