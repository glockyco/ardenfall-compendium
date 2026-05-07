import { describe, expect, it } from "bun:test";
import { mergeOperations, type OperationMap } from "$pipeline/registry";

describe("mergeOperations", () => {
  it("merges typed maps without losing names", () => {
    const a: OperationMap = { "core.linkBack": (x: unknown) => x };
    const b: OperationMap = { "item.computeSubtypeLabel": (x: unknown) => x };
    const merged = mergeOperations([a, b]);
    expect(Object.keys(merged).sort()).toEqual(["core.linkBack", "item.computeSubtypeLabel"]);
  });

  it("rejects duplicates with a clear error", () => {
    const a: OperationMap = { "x.y": () => 0 };
    const b: OperationMap = { "x.y": () => 1 };
    expect(() => mergeOperations([a, b])).toThrow(/duplicate operation: x.y/);
  });

  it("rejects empty merges defensively", () => {
    expect(() => mergeOperations([])).toThrow(/no operation maps/);
  });
});
