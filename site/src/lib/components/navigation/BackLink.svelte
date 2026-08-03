<script lang="ts">
  /**
   * The link back to a listing page. Every detail page shows one, so the text repeats
   * across the site. data-pagefind-ignore keeps it out of the search index, where it
   * would start every result extract with the same words.
   */
  let { href, label }: { href: string; label: string } = $props();
</script>

<a data-pagefind-ignore class="inline-flex min-h-6 items-center text-sm underline" {href}
  >&larr; back to {label}</a
>
