import { readFileSync } from "node:fs";
import { describe, expect, it } from "bun:test";

const lefthook = readFileSync("lefthook.yml", "utf8");
const prettierIgnore = readFileSync(".prettierignore", "utf8");

describe("format tooling", () => {
  it("formats mjs files in the pre-commit prettier hook", () => {
    expect(lefthook).toContain("mjs");
  });

  it("ignores generated mod test build output", () => {
    expect(prettierIgnore).toContain("mod-tests/bin/");
    expect(prettierIgnore).toContain("mod-tests/obj/");
  });
});
