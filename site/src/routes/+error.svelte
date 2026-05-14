<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { Button } from "$lib/components/ui/button/index.js";

  const title = $derived(
    page.status === 404 ? "Item not found" : (page.error?.message ?? "Something went wrong"),
  );
</script>

<section class="mx-auto flex max-w-md flex-col items-start gap-4 px-6 py-16">
  <p class="text-muted-foreground text-sm tracking-widest uppercase">Error {page.status}</p>
  <h1 class="text-3xl font-semibold">{title}</h1>
  <p class="text-muted-foreground">
    {#if page.status === 404}
      That item doesn't exist in the current snapshot. It may have been removed in a later patch or
      never existed at all.
    {:else}
      An unexpected error occurred while loading this page. Reloading may resolve it; if it doesn't,
      share the error message shown here when reporting the issue.
    {/if}
  </p>
  {#if page.status !== 404 && page.error?.message}
    <p class="bg-muted text-muted-foreground rounded-md px-3 py-2 text-sm break-words">
      {page.error.message}
    </p>
  {/if}
  <div class="flex gap-2">
    <Button href={resolve("/")}>Back to home</Button>
    {#if page.status !== 404}
      <Button variant="outline" onclick={() => window.location.reload()}>Reload</Button>
    {/if}
  </div>
</section>
