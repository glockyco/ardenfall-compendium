<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { decodeSearchQuery, encodeSearchQuery } from "$lib/search/url-state";
  import { searchDisplayState, type SearchStatus } from "$lib/search/state";

  interface PagefindResultData {
    url: string;
    excerpt?: string;
    meta?: Record<string, unknown>;
  }

  interface PagefindResult {
    id: string;
    data: () => Promise<PagefindResultData>;
  }

  interface PagefindSearchResponse {
    results: PagefindResult[];
  }

  interface PagefindApi {
    init: () => Promise<void>;
    search: (query: string) => Promise<PagefindSearchResponse>;
  }

  interface SearchResult {
    url: string;
    title: string;
    section: string;
    excerpt: string;
  }

  const sections = [
    { prefix: "/items", label: "Items" },
    { prefix: "/terms", label: "Items" },
    { prefix: "/spells", label: "Spells" },
    { prefix: "/status-effects", label: "Status Effects" },
    { prefix: "/stats", label: "Stats" },
    { prefix: "/categories", label: "Categories" },
    { prefix: "/tags", label: "Tags" },
    { prefix: "/characters", label: "Characters" },
    { prefix: "/locations", label: "Locations" },
    { prefix: "/map", label: "Map" },
  ];

  let inputValue = $state("");
  let activeQuery = $state("");
  let status = $state<SearchStatus>("idle");
  let results = $state<SearchResult[]>([]);
  let seenQuery = $state<string | null>(null);
  let searchVersion = 0;
  let pagefindPromise: Promise<PagefindApi> | null = null;
  const displayState = $derived(searchDisplayState(activeQuery, status, results.length));

  const loadPagefind = (): Promise<PagefindApi> => {
    pagefindPromise ??= (async () => {
      // Pagefind resolves its index files against the site root, so it must load from
      // its served path. Vite must not rewrite this import into a bundled module.
      const url = new URL("/pagefind/pagefind.js", window.location.origin).href;
      const api = (await import(/* @vite-ignore */ url)) as PagefindApi;
      await api.init();
      return api;
    })();
    return pagefindPromise;
  };

  // Pagefind indexes files, so it returns the prerendered filename. The site serves the
  // same page without the extension, and that is the address a reader can share.
  const pageUrl = (url: string): string => url.replace(/\.html$/, "").replace(/\/index$/, "/");

  // Pagefind returns an excerpt as HTML with <mark> around each matched word. Rendering
  // that HTML directly would trust page-derived text, so the excerpt is split into plain
  // segments and Svelte escapes each one.
  const excerptSegments = (excerpt: string): { text: string; matched: boolean }[] => {
    const segments: { text: string; matched: boolean }[] = [];
    const pattern = /<mark>([\s\S]*?)<\/mark>/g;
    let cursor = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(excerpt)) !== null) {
      if (match.index > cursor) {
        segments.push({ text: decodeEntities(excerpt.slice(cursor, match.index)), matched: false });
      }
      segments.push({ text: decodeEntities(match[1] ?? ""), matched: true });
      cursor = match.index + match[0].length;
    }
    if (cursor < excerpt.length) {
      segments.push({ text: decodeEntities(excerpt.slice(cursor)), matched: false });
    }
    return segments;
  };

  const decodeEntities = (value: string): string =>
    value
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&quot;", '"')
      .replaceAll("&#39;", "'")
      .replaceAll("&amp;", "&");

  const sectionForUrl = (url: string): string => {
    try {
      const pathname = new URL(url, window.location.origin).pathname;
      return (
        sections.find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`))
          ?.label ?? "Compendium"
      );
    } catch {
      return "Compendium";
    }
  };

  const stringMeta = (data: PagefindResultData, key: string): string | null => {
    const value = data.meta?.[key];
    return typeof value === "string" && value.trim().length > 0 ? value : null;
  };

  const search = async (query: string): Promise<void> => {
    const version = ++searchVersion;
    if (query.length === 0) {
      status = "idle";
      results = [];
      return;
    }

    status = "loading";
    results = [];
    try {
      const pagefind = await loadPagefind();
      const response = await pagefind.search(query);
      const data = await Promise.all(response.results.map((result) => result.data()));
      if (version !== searchVersion) return;

      results = data.map((result) => ({
        url: pageUrl(result.url),
        title: stringMeta(result, "title") ?? "Compendium page",
        section: stringMeta(result, "section") ?? sectionForUrl(result.url),
        excerpt: result.excerpt ?? "",
      }));
      status = results.length === 0 ? "empty" : "results";
    } catch {
      if (version !== searchVersion) return;
      status = "error";
      results = [];
    }
  };

  $effect(() => {
    const nextQuery = decodeSearchQuery(page.url.searchParams);
    if (nextQuery === seenQuery) return;
    seenQuery = nextQuery;
    activeQuery = nextQuery;
    inputValue = nextQuery;
    void search(nextQuery);
  });

  const submit = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();
    const query = inputValue.trim();
    const encoded = encodeSearchQuery(query);
    const destination = encoded ? `${resolve("/search")}?${encoded}` : resolve("/search");
    // eslint-disable-next-line svelte/no-navigation-without-resolve -- same-page query sync to the static /search route
    await goto(destination, { keepFocus: true });
  };
</script>

<section data-pagefind-ignore aria-labelledby="search-heading" class="mx-auto max-w-3xl space-y-6">
  <header>
    <h1 id="search-heading" class="text-3xl font-semibold tracking-tight">Search the compendium</h1>
    <p class="text-muted-foreground mt-2">Find pages by name or description.</p>
  </header>

  <form class="flex flex-col gap-3 sm:flex-row" onsubmit={submit}>
    <label for="compendium-search" class="sr-only">Search the compendium</label>
    <input
      id="compendium-search"
      class="border-input-border focus:border-primary min-h-11 w-full rounded border px-3 py-2"
      type="search"
      name="q"
      placeholder="Search pages"
      autocomplete="off"
      bind:value={inputValue}
    />
    <button
      class="bg-primary text-primary-foreground hover:bg-primary/90 min-h-11 rounded px-4 py-2 font-medium"
      type="submit"
    >
      Search
    </button>
  </form>

  <div class="sr-only" aria-live="polite" aria-atomic="true">
    {displayState.message}
  </div>

  {#if displayState.kind === "guidance"}
    <div class="border-border bg-muted/30 rounded-lg border p-5">
      <p class="text-muted-foreground">Enter a name or description to find a page.</p>
    </div>
  {:else if displayState.kind === "loading"}
    <p class="text-muted-foreground" role="status">Searching for {activeQuery}.</p>
  {:else if displayState.kind === "error"}
    <div class="border-destructive/50 bg-destructive/10 rounded-lg border p-5" role="alert">
      <p>Search is not available because the search script did not load.</p>
      <p class="text-muted-foreground mt-2">Enable JavaScript, then try again.</p>
    </div>
  {:else if displayState.kind === "empty"}
    <div class="border-border bg-muted/30 rounded-lg border p-5">
      <p>No results for “{activeQuery}”.</p>
      <p class="text-muted-foreground mt-2">
        Try a different search, or <a class="underline" href={resolve("/search")}
          >clear the search</a
        >.
      </p>
    </div>
  {:else}
    <div class="space-y-4">
      <h2 class="text-lg font-semibold" id="search-results-heading">
        {results.length}
        {results.length === 1 ? "result" : "results"} for “{activeQuery}”
      </h2>
      <ol aria-labelledby="search-results-heading" class="space-y-4">
        {#each results as result (result.url)}
          <li class="border-border rounded-lg border p-4">
            <a
              class="focus-visible:ring-ring block rounded focus-visible:ring-2 focus-visible:outline-none"
              href={result.url}
            >
              <h3 class="text-lg font-semibold">{result.title}</h3>
              <p class="text-muted-foreground mt-1 text-sm">{result.section}</p>
              {#if result.excerpt.length > 0}
                <p class="mt-3 text-sm leading-6">
                  {#each excerptSegments(result.excerpt) as segment, index (index)}
                    {#if segment.matched}<mark class="bg-primary/20 text-foreground rounded px-0.5"
                        >{segment.text}</mark
                      >{:else}{segment.text}{/if}
                  {/each}
                </p>
              {/if}
            </a>
          </li>
        {/each}
      </ol>
    </div>
  {/if}

  <noscript>
    <p class="border-border bg-muted/30 rounded-lg border p-5">
      Search needs JavaScript. Enable JavaScript to search the compendium.
    </p>
  </noscript>
</section>
