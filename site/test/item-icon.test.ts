import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

describe("ItemIcon tinting", () => {
  it("renders displayIconColor through a mask-image tint branch", () => {
    const source = readFileSync("site/src/lib/components/items/ItemIcon.svelte", "utf8");

    expect(source).toContain("displayIconColor");
    expect(source).toContain("function tint");
    expect(source).toContain("style:background-color={tintHex}");
    expect(source).toContain("style:mask-image={`url(${src})`}");
    expect(source).toContain("style:-webkit-mask-image={`url(${src})`}");
  });

  it("keeps an image branch for untinted icons", () => {
    const source = readFileSync("site/src/lib/components/items/ItemIcon.svelte", "utf8");

    expect(source).toContain("{:else}");
    expect(source).toContain("<img");
  });
});
