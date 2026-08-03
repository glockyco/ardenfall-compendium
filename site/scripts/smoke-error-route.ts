#!/usr/bin/env bun
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const sourcePath = join(import.meta.dirname, "..", "src", "routes", "+error.svelte");
const source = readFileSync(sourcePath, "utf8");
// Asserts the error route's user-visible affordances. Deliberately checks the
// rendered labels and the fact that recovery is a plain link, not the mechanism
// behind it: the root layout disables CSR, so any recovery control that needs
// hydration silently does nothing on the routes that can actually error.
const requiredSnippets: string[] = [
  "<svelte:head>",
  "Error {page.status}",
  "This page is not in the current snapshot",
  "Back to home",
  ">Reload<",
  "href={page.url.pathname + page.url.search}",
];

for (const snippet of requiredSnippets) {
  if (!source.includes(snippet)) {
    throw new Error(`+error.svelte is missing expected error-route text: ${snippet}`);
  }
}

// The error component only renders when the Worker runs. An address matching no page never
// reaches it, so Cloudflare must serve a 404 asset instead. Check that the asset exists, that it
// carries the compendium's own page rather than the adapter's plaintext placeholder, and that the
// setting which makes Cloudflare serve it is still present.
const fallbackPath = join(import.meta.dirname, "..", ".svelte-kit", "cloudflare", "404.html");
if (!existsSync(fallbackPath)) {
  throw new Error(
    "missing .svelte-kit/cloudflare/404.html, so an unmatched address reaches the Worker",
  );
}
const fallback = readFileSync(fallbackPath, "utf8");
if (!fallback.includes("Page not found")) {
  throw new Error(
    "404.html is the adapter placeholder, so the /404 route did not prerender over it",
  );
}

const wranglerConfig = readFileSync(join(import.meta.dirname, "..", "wrangler.toml"), "utf8");
if (!wranglerConfig.includes('not_found_handling = "404-page"')) {
  throw new Error("wrangler.toml must set not_found_handling so Cloudflare serves 404.html");
}
