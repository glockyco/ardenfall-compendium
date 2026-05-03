import { describe, expect, it } from "bun:test";
import { runStages } from "$pipeline/orchestrator";
import type { Stage, StageContext } from "$pipeline/types";

const ctx: StageContext = {
  workspaceRoot: ".",
  snapshotDir: "snapshots/test",
  outDir: "pipeline/out/test",
  log: () => undefined,
};

function stage<I, O>(id: string, inputs: string[], run: (i: I, c: StageContext) => O): Stage<I, O> {
  return { id, inputs, run };
}

describe("orchestrator", () => {
  it("runs an empty plan", async () => {
    const result = await runStages([], {}, ctx);
    expect(result).toEqual({});
  });

  it("topo-sorts a diamond dependency", async () => {
    const order: string[] = [];
    const A = stage("a", [], () => {
      order.push("a");
      return "A";
    });
    const B = stage("b", ["a"], () => {
      order.push("b");
      return "B";
    });
    const C = stage("c", ["a"], () => {
      order.push("c");
      return "C";
    });
    const D = stage("d", ["b", "c"], () => {
      order.push("d");
      return "D";
    });
    const result = await runStages([D, B, A, C], {}, ctx);
    expect(order[0]).toBe("a");
    expect(order[3]).toBe("d");
    expect(result).toEqual({ a: "A", b: "B", c: "C", d: "D" });
  });

  it("rejects a missing input", async () => {
    const A = stage("a", ["does-not-exist"], () => "A");
    await expect(runStages([A], {}, ctx)).rejects.toThrow(/unsatisfied input/);
  });

  it("rejects a cycle", async () => {
    const A = stage("a", ["b"], () => "A");
    const B = stage("b", ["a"], () => "B");
    await expect(runStages([A, B], {}, ctx)).rejects.toThrow(/cycle/);
  });
});
