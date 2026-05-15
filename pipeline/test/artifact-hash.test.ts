import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { sha256File, sha256Json, sha256Tree } from "../src/artifacts/hash";

describe("artifact hash helpers", () => {
  it("hashes JSON deterministically by its serialized bytes", () => {
    expect(sha256Json({ b: 2, a: 1 })).toBe(
      "3fb75453225c732a76b7899ea2096dda1455189c89817239732182f73fe5a09f",
    );
  });

  it("hashes files and asset trees deterministically", async () => {
    const root = mkdtempSync(join(tmpdir(), "ardenfall-artifact-hash-"));
    try {
      mkdirSync(join(root, "assets"), { recursive: true });
      writeFileSync(join(root, "data.sqlite"), "sqlite bytes");
      writeFileSync(join(root, "assets", "b.webp"), "b");
      writeFileSync(join(root, "assets", "a.webp"), "a");

      expect(await sha256File(join(root, "data.sqlite"))).toBe(
        "00a2dbeb3c729659ffb7b52d5ea7440b9e963f89deb21c0dfdc9eae3c95b76df",
      );
      expect(await sha256Tree(join(root, "assets"))).toBe(
        "22bb4cedb70c4b34bf322d3b8b2ea2b454ac593d0c9df4bd569375ea387df5d3",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
