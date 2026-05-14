import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "bun:test";
import { buildCommandPlan, defaultOptions } from "./scripts/decompile-ardenfall.mjs";

const gitignore = readFileSync(".gitignore", "utf8");
const lefthook = readFileSync("lefthook.yml", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>;
};
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

describe("decompilation tooling", () => {
  it("keeps the local decompiled source cache out of git", () => {
    expect(gitignore).toContain(".decompiled/");
  });

  it("exposes a root decompile script", () => {
    expect(packageJson.scripts["decompile:game"]).toBe("bun run scripts/decompile-ardenfall.mjs");
    expect(existsSync("scripts/decompile-ardenfall.mjs")).toBe(true);
  });

  it("plans reproducible decompile commands for the Ardenfall game assembly", () => {
    const options = defaultOptions({
      assembly: "mod/libs/Assembly-CSharp.dll",
      gameVersion: "0.0.10.91",
      sha256: "abcdef1234567890",
      repoRoot: "/repo",
    });

    const plan = buildCommandPlan(options);

    expect(plan.outputDir).toBe("/repo/.decompiled/0.0.10.91-abcdef123456");
    expect(plan.commands.some((command) => command.args.includes("--nested-directories"))).toBe(
      true,
    );
    const projectCommand = plan.commands.find((command) => command.name === "ilspy project");
    expect(projectCommand?.allowFailure).toBe(true);
    expect(
      plan.commands.some(
        (command) => command.name.startsWith("ilspy type") && !command.allowFailure,
      ),
    ).toBe(true);
    expect(plan.commands.some((command) => command.args.includes("Ardenfall.Item.ItemData"))).toBe(
      true,
    );
    expect(
      plan.commands.some((command) => command.args.includes("Ardenfall.Item.ThrowingPotionData")),
    ).toBe(true);
    expect(
      plan.commands.some((command) => command.args.includes("Ardenfall.LeveledSpellData")),
    ).toBe(true);
    expect(
      plan.commands.some((command) => command.args.includes("Ardenfall.Item.LeveledSpellData")),
    ).toBe(false);
    expect(plan.commands.some((command) => command.args.includes("--ilcode"))).toBe(true);
  });
});
