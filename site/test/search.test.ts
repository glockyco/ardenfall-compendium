import { describe, expect, it } from "bun:test";
import { decodeSearchQuery, encodeSearchQuery } from "../src/lib/search/url-state";
import { searchDisplayState } from "../src/lib/search/state";

describe("search URL state", () => {
  it("round-trips a query through the URL parameter", () => {
    const query = "  arcane shield  ";
    const encoded = encodeSearchQuery(query);
    const decoded = decodeSearchQuery(new URLSearchParams(encoded));

    expect(new URLSearchParams(encoded).get("q")).toBe("arcane shield");
    expect(decoded).toBe("arcane shield");
  });

  it("leaves the query parameter out for empty input", () => {
    expect(encodeSearchQuery("   ")).toBe("");
    expect(decodeSearchQuery(new URLSearchParams("q="))).toBe("");
  });
});

describe("search display states", () => {
  it("guides a reader who has not entered a query", () => {
    expect(searchDisplayState("", "idle", 0)).toEqual({
      kind: "guidance",
      message: "Enter a name or description to find a page.",
    });
  });

  it("names a query with no results", () => {
    expect(searchDisplayState("unknown relic", "empty", 0)).toEqual({
      kind: "empty",
      message: "No results for unknown relic.",
    });
  });

  it("reports a blocked search script", () => {
    expect(searchDisplayState("relic", "error", 0)).toEqual({
      kind: "error",
      message: "Search is not available because the search script did not load.",
    });
  });
});
