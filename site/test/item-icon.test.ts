import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const builtItemsPage = [
  join(import.meta.dir, "../.svelte-kit/cloudflare/items/index.html"),
  join(import.meta.dir, "../.svelte-kit/cloudflare/items.html"),
].find(existsSync);
if (!builtItemsPage) throw new Error("missing built item overview page");

describe("ItemIcon rendering", () => {
  it("renders a tinted bitmap icon in the built item overview", () => {
    const output = readFileSync(builtItemsPage, "utf8");

    expect(output).toContain('class="item-icon');
    expect(output).toMatch(
      /style="background-color: #[0-9a-f]{6}; mask-image: url\(\/assets\/[^"]+\.webp\);/,
    );
    expect(output).toMatch(
      /<img[^>]+src="\/assets\/[^"]+\.webp"[^>]+style="mix-blend-mode: multiply;"\/>/,
    );
  });

  it("renders bitmap image elements in the built item overview", () => {
    const output = readFileSync(builtItemsPage, "utf8");

    expect(output).toMatch(/<img[^>]+src="\/assets\/[^"]+\.webp"[^>]*>/);
  });
});
