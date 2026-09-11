import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { currentStagePaths } from "./stage-paths.mjs";

// A fixture build and a live build write their own directories, so neither overwrites the other.
const stage = currentStagePaths(import.meta.dirname);

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // Every route prerenders, and the build database lives in site/.data and is never deployed, so
    // no request can be rendered at run time. A Worker in front of these files could therefore only
    // fail, and it did: an address matching no page returned 500 rather than 404. The static adapter
    // emits files alone, Cloudflare serves them, and `not_found_handling` in wrangler.toml serves
    // 404.html for a miss.
    //
    // `strict` stays off because it rejects a dynamic route by its shape, even when every instance
    // prerenders through `entries()`. The guard that matters is each route's own `prerender = true`,
    // which fails the build when a page stops being prerenderable.
    adapter: adapter({
      pages: stage.outputDir,
      assets: stage.outputDir,
      strict: false,
    }),
    alias: { $lib: "src/lib" },
    // The staged static root: the tracked files plus this artifact's assets and `_release.json`.
    files: { assets: stage.staticDir },
  },
};

export default config;
