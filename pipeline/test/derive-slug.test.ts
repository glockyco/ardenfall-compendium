import { describe, expect, it } from "bun:test";
import { deriveSlug, deriveShortId, kebab } from "$pipeline/slug/derive-slug";

describe("kebab", () => {
  it("lowercases ASCII and collapses non-alphanumerics", () => {
    expect(kebab("Iron Sword")).toBe("iron-sword");
    expect(kebab("  POTION of  Lesser   Restore Health!! ")).toBe(
      "potion-of-lesser-restore-health",
    );
    expect(kebab("BASE Arrow")).toBe("base-arrow");
  });

  it("strips leading and trailing dashes", () => {
    expect(kebab("--Foo--")).toBe("foo");
  });

  it("returns an empty string when input has no alphanumerics", () => {
    expect(kebab("!!!")).toBe("");
  });
});

describe("deriveShortId", () => {
  it("takes the first 8 hex characters before any '.' suffix", () => {
    expect(deriveShortId("4ed202185a05d98439595e3fcab021c8.11400000")).toBe("4ed20218");
    expect(deriveShortId("ABCDEF0123")).toBe("abcdef01");
  });

  it("derives the first 8 hex characters from a record id", () => {
    expect(deriveShortId("instances;portals;398213e43a41b4c47bffe4ef1998e782")).toBe("398213e4");
  });

  it("keeps collisions for ids sharing the same first 8 hex characters", () => {
    const first = deriveShortId("instances;portals;398213e43a41b4c47bffe4ef1998e782");
    const second = deriveShortId("instances;portals;398213e4deadbeef0123456789abcdef");
    expect(first).toBe(second);
  });

  it("rejects ids matching neither accepted format", () => {
    expect(() => deriveShortId("abc")).toThrow(/short_id/);
    expect(() => deriveShortId("world;portals;portal-a")).toThrow(
      /world;portals;portal-a.*<8hex>.*<table>;<subtable>;<recordId>/,
    );
  });
});

describe("deriveSlug", () => {
  it("composes `<kebab>--<id8>`", () => {
    expect(
      deriveSlug({
        displayName: "Iron Sword",
        assetId: "4ed202185a05d98439595e3fcab021c8.11400000",
      }),
    ).toBe("iron-sword--4ed20218");
  });

  it("falls back to `entity--<id8>` when the displayName slugs to empty", () => {
    expect(
      deriveSlug({ displayName: "???", assetId: "4ed202185a05d98439595e3fcab021c8.11400000" }),
    ).toBe("entity--4ed20218");
  });
});
