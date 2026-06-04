import { readFileSync } from "node:fs";
import { join } from "node:path";

const out = join(process.cwd(), ".svelte-kit", "cloudflare", "map.html");
const html = readFileSync(out, "utf8");

const must = ["Harbor Town", "Loading map", ">Map<"];
for (const needle of must) {
  if (!html.includes(needle)) {
    throw new Error(`map.html is missing expected content: ${needle}`);
  }
}

// deck.gl must be a lazily-loaded client chunk, never inlined in the prerendered HTML.
if (/@deck\.gl\/core/.test(html)) {
  throw new Error("deck.gl appears inlined in the prerendered map HTML");
}
