import { describe, expect, it } from "bun:test";
import { parseSlugParam } from "$lib/server/route-slug";

describe("parseSlugParam", () => {
  it("splits `<kebab>--<id8>` into parts", () => {
    expect(parseSlugParam("iron-sword--4ed20218")).toEqual({
      slug: "iron-sword--4ed20218",
      humanSlug: "iron-sword",
      shortId: "4ed20218",
      hasShortId: true,
    });
  });

  it("rejects malformed slugs", () => {
    expect(parseSlugParam("iron-sword")).toEqual({
      slug: "iron-sword",
      humanSlug: "iron-sword",
      shortId: null,
      hasShortId: false,
    });
    expect(parseSlugParam("--abc12345")).toEqual({
      slug: "--abc12345",
      humanSlug: "",
      shortId: "abc12345",
      hasShortId: true,
    });
  });

  it("accepts only lowercase hex for the short id", () => {
    expect(parseSlugParam("iron-sword--ABC12345")).toEqual({
      slug: "iron-sword--ABC12345",
      humanSlug: "iron-sword--abc12345",
      shortId: null,
      hasShortId: false,
    });
  });
});
