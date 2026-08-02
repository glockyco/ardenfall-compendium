import adapter from "@sveltejs/adapter-cloudflare";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // Cloudflare adapter writes a Worker entry plus prerendered/static assets
    // into .svelte-kit/cloudflare. Keep almost all generated routes
    // prerendered so matching HTML and WebP files are served by Workers Static
    // Assets without invoking the Worker. The build-time SQLite database stays
    // in site/.data and is never copied into the served asset bundle.
    adapter: adapter({}),
    alias: { $lib: "src/lib" },
  },
};

export default config;
