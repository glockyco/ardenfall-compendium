import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  optimizeDeps: {
    // The official SQLite Wasm build must NOT be pre-bundled by Vite — its
    // `.wasm` companion is fetched at runtime via the published exports.
    exclude: ["@sqlite.org/sqlite-wasm"],
  },
});
