import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { buildCommandPlan, defaultOptions } from "./scripts/decompile-ardenfall.mjs";
import { tmpdir } from "node:os";

import { syncGeneratedArtifacts } from "./site/scripts/sync-generated-artifacts.mjs";
const gitignore = readFileSync(".gitignore", "utf8");
const lefthook = readFileSync("lefthook.yml", "utf8");
const ciWorkflow = readFileSync(".github/workflows/ci.yml", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>;
};
const prettierIgnore = readFileSync(".prettierignore", "utf8");

const sitePackageJson = JSON.parse(readFileSync("site/package.json", "utf8")) as {
  scripts: Record<string, string>;
};
const siteLayout = readFileSync("site/src/routes/+layout.ts", "utf8");
const siteSvelteConfig = readFileSync("site/svelte.config.js", "utf8");
const siteWranglerConfig = readFileSync("site/wrangler.toml", "utf8");
describe("format tooling", () => {
  it("formats mjs files in the pre-commit prettier hook", () => {
    expect(lefthook).toContain("mjs");
  });

  it("ignores generated mod test build output", () => {
    expect(prettierIgnore).toContain("mod-tests/bin/");
    expect(prettierIgnore).toContain("mod-tests/obj/");
  });
});

describe("ci site build tooling", () => {
  it("builds the CI SQLite output where the site build sync expects it", () => {
    expect(ciWorkflow).toContain("bun run pipeline:run fixtures/synthetic/snapshot pipeline/dist");
    expect(ciWorkflow).not.toContain(
      "bun run pipeline:run fixtures/synthetic/snapshot site/static",
    );
    expect(ciWorkflow).toContain("bun test tooling.test.ts");
    expect(ciWorkflow).toContain("site: ${{ steps.filter.outputs.site }}");
    expect(ciWorkflow).toContain("- 'site/**'");
    expect(ciWorkflow).toContain("- 'tooling.test.ts'");
    expect(ciWorkflow).toContain("needs.changes.outputs.site == 'true'");
    expect(ciWorkflow).toContain("needs.changes.outputs.fixtures == 'true'");
  });
});

describe("site deployment tooling", () => {
  it("deploys by syncing generated pipeline artifacts before build", () => {
    expect(sitePackageJson.scripts["sync:generated"]).toBe(
      "bun run scripts/sync-generated-artifacts.mjs",
    );
    expect(sitePackageJson.scripts.build).toBe("bun run sync:generated && vite build");
    expect(sitePackageJson.scripts["cf-deploy"]).toBe("bun run build && wrangler deploy");
    expect(existsSync("site/scripts/sync-generated-artifacts.mjs")).toBe(true);
  });

  it("copies SQLite and assets while pruning stale managed assets", () => {
    const root = mkdtempSync(join(tmpdir(), "ardenfall-site-generated-"));
    try {
      const source = join(root, "pipeline", "dist");
      const target = join(root, "site", "static");
      mkdirSync(join(source, "assets"), { recursive: true });
      mkdirSync(join(target, "assets"), { recursive: true });
      writeFileSync(join(source, "data.sqlite"), "sqlite bytes");
      writeFileSync(join(source, "assets", "fresh.webp"), "fresh");
      writeFileSync(join(target, "assets", "stale.webp"), "stale");

      const result = syncGeneratedArtifacts({ sourceDir: source, targetDir: target });

      expect(result.sqliteBytes).toBe(12);
      expect(readFileSync(join(target, "data.sqlite"), "utf8")).toBe("sqlite bytes");
      expect(readFileSync(join(target, "assets", "fresh.webp"), "utf8")).toBe("fresh");
      expect(existsSync(join(target, "assets", "stale.webp"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects missing and empty generated asset bundles", () => {
    const root = mkdtempSync(join(tmpdir(), "ardenfall-site-generated-invalid-"));
    try {
      const source = join(root, "pipeline", "dist");
      const target = join(root, "site", "static");
      mkdirSync(source, { recursive: true });
      writeFileSync(join(source, "data.sqlite"), "sqlite bytes");

      expect(() => syncGeneratedArtifacts({ sourceDir: source, targetDir: target })).toThrow(
        /Missing generated asset bundle/,
      );

      mkdirSync(join(source, "assets"), { recursive: true });
      writeFileSync(join(source, "assets", "empty.webp"), "");
      expect(() => syncGeneratedArtifacts({ sourceDir: source, targetDir: target })).toThrow(
        /Invalid generated asset/,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("site prerender architecture", () => {
  it("defaults routes to static prerendered SSR without client hydration", () => {
    expect(siteLayout).toContain("export const ssr = true");
    expect(siteLayout).toContain("export const prerender = true");
    expect(siteLayout).toContain("export const csr = false");
    expect(siteLayout).not.toContain("ssr = false");
    expect(siteLayout).not.toContain("prerender = false");
  });

  it("keeps Cloudflare static assets ahead of Worker execution", () => {
    expect(siteSvelteConfig).toContain("adapter({})");
    expect(siteWranglerConfig).toContain('directory = ".svelte-kit/cloudflare"');
    expect(siteWranglerConfig).toContain('binding = "ASSETS"');
    expect(siteWranglerConfig).not.toContain("run_worker_first = true");
  });

  it("has a prerender smoke script wired into the site package", () => {
    expect(sitePackageJson.scripts["smoke:prerender"]).toBe(
      "bun run scripts/smoke-prerender-output.mjs",
    );
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
