import { describe, expect, it } from "bun:test";
import { resolveItemDisplayLabel } from "../src/entities/item/read-models.ts";

describe("item display labels", () => {
  it("uses a placeholder and reports a missing name", () => {
    const result = resolveItemDisplayLabel(null, null);

    expect(result).toEqual({ label: "Unnamed item", missing: true });
    expect(result.label).not.toBe("");
    expect(result.label).not.toContain("named;");
  });

  it("uses the canonical name when it exists", () => {
    expect(resolveItemDisplayLabel("Iron Sword", null)).toEqual({
      label: "Iron Sword",
      missing: false,
    });
  });
});
