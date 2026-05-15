import adapter from "@sveltejs/adapter-cloudflare";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // Cloudflare adapter writes a Worker entry plus prerendered/static assets
    // into .svelte-kit/cloudflare. Keep almost all generated routes
    // prerendered so matching HTML, data.sqlite, and WebP files are served by
    // Workers Static Assets without invoking the Worker.
    adapter: adapter({}),
    alias: { $lib: "src/lib" },
  },
};

export default config;
