import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { currentStagePaths } from "./stage-paths.mjs";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// A fixture build and a live build write their own directories, so neither overwrites the other.
const stage = currentStagePaths(import.meta.dirname);

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit({
      preprocess: vitePreprocess(),
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
      // The staged static root: the tracked files plus this artifact's assets and `_release.json`.
      files: { assets: stage.staticDir },
    }),
  ],
  optimizeDeps: {
    // The official SQLite Wasm build must NOT be pre-bundled by Vite — its
    // `.wasm` companion is fetched at runtime via the published exports.
    exclude: ["@sqlite.org/sqlite-wasm"],
  },
});
