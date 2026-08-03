<script lang="ts">
  import { resolve } from "$app/paths";
</script>

<svelte:head>
  <title>Page not found · Ardenfall Compendium</title>
  <meta
    name="description"
    content="This address does not match a page in the Ardenfall Compendium."
  />
  <meta name="robots" content="noindex" />
</svelte:head>

<!--
  Cloudflare serves this file for any address that matches no page, because `not_found_handling`
  is set to `404-page`. The Worker is never asked, which matters because the build database is not
  deployed and the Worker cannot render a page it has no data for.
-->
<section class="mx-auto max-w-2xl space-y-4">
  <h1 class="text-3xl font-semibold tracking-tight">Page not found</h1>
  <p class="text-muted-foreground">
    This address does not match a page. The compendium is generated from the game, so a page can
    also disappear when the game stops shipping the thing it described.
  </p>
  <p>
    <a class="underline underline-offset-4" href={resolve("/search")}>Search for a page by name</a>
    , or start from the
    <a class="underline underline-offset-4" href={resolve("/")}>home page</a>.
  </p>
</section>
