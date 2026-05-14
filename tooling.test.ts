import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { buildCommandPlan, defaultOptions } from "./scripts/decompile-ardenfall.mjs";
import { tmpdir } from "node:os";

import { syncDataSqlite } from "./site/scripts/sync-data-sqlite.mjs";
const gitignore = readFileSync(".gitignore", "utf8");
const lefthook = readFileSync("lefthook.yml", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>;
};
const prettierIgnore = readFileSync(".prettierignore", "utf8");

const sitePackageJson = JSON.parse(readFileSync("site/package.json", "utf8")) as {
  scripts: Record<string, string>;
};
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
  describe("site deployment tooling", () => {
    it("deploys by building with the latest pipeline SQLite output", () => {
      expect(sitePackageJson.scripts["sync:data"]).toBe("bun run scripts/sync-data-sqlite.mjs");
      expect(sitePackageJson.scripts.build).toBe("bun run sync:data && vite build");
      expect(sitePackageJson.scripts["cf-deploy"]).toBe("bun run build && wrangler deploy");
      expect(existsSync("site/scripts/sync-data-sqlite.mjs")).toBe(true);
    });

    it("copies the pipeline SQLite blob into site static assets", () => {
      const root = mkdtempSync(join(tmpdir(), "ardenfall-site-data-"));
      try {
        const source = join(root, "pipeline.sqlite");
        const target = join(root, "static", "data.sqlite");
        writeFileSync(source, "sqlite bytes");

        const result = syncDataSqlite({ source, target });

        expect(result.bytes).toBe(12);
        expect(readFileSync(target, "utf8")).toBe("sqlite bytes");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });
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
