import { describe, expect, it } from "bun:test";
import { assertReproducibleExports, type ExportEvidence } from "../src/export-reproducibility";

function recordedExport(timingMs: number): ExportEvidence {
  return {
    counts: { item: 2, character: 1, location: 1 },
    filteredRuntimeCreatedCount: 22,
    hashes: {
      "items.json": "hash-items",
      "characters.json": "hash-characters",
      "locations.json": "hash-locations",
    },
    timings: [{ phase: "publish", elapsedMs: timingMs }],
  };
}

describe("export reproducibility", () => {
  it("accepts two exports from one session when only timing records differ", () => {
    const first = recordedExport(31);
    const second = recordedExport(47);

    expect(() => assertReproducibleExports(first, second)).not.toThrow();
  });

  it("rejects a changed family count, filtered runtime-created count, or artifact hash", () => {
    const first = recordedExport(31);
    const second = recordedExport(47);
    second.counts.item = 3;

    expect(() => assertReproducibleExports(first, second)).toThrow(
      /Reproducibility check failed: family counts differ/,
    );

    second.counts.item = 2;
    second.filteredRuntimeCreatedCount = 21;
    expect(() => assertReproducibleExports(first, second)).toThrow(
      /Reproducibility check failed: filtered runtime-created count differs/,
    );

    second.filteredRuntimeCreatedCount = first.filteredRuntimeCreatedCount;
    second.hashes["items.json"] = "different-hash";
    expect(() => assertReproducibleExports(first, second)).toThrow(
      /Reproducibility check failed: artifact hashes differ/,
    );
  });
});
