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
  dependencies?: Record<string, string>;
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
  it("builds fixture artifacts where the site fixture build expects them", () => {
    expect(ciWorkflow).toContain("bun run artifact:fixture synthetic fixtures/synthetic/snapshot");
    expect(ciWorkflow).not.toContain(
      "bun run pipeline:run fixtures/synthetic/snapshot pipeline/dist",
    );
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

  it("separates fixture artifact builds from release artifact builds", () => {
    expect(packageJson.scripts["artifact:fixture"]).toBe(
      "bun run pipeline/src/cli.ts build-fixture",
    );
    expect(packageJson.scripts["artifact:release"]).toBe(
      "bun run pipeline/src/cli.ts build-release",
    );
    expect(ciWorkflow).toContain("bun run artifact:fixture synthetic fixtures/synthetic/snapshot");
    expect(ciWorkflow).not.toContain("fixtures/synthetic/snapshot pipeline/dist");
  });
});

describe("snapshot provenance", () => {
  it("requires snapshot manifests to declare source provenance", () => {
    const schema = JSON.parse(readFileSync("schemas/manifest.schema.json", "utf8")) as {
      required: string[];
      properties: Record<string, unknown>;
    };
    const fixtureManifest = JSON.parse(
      readFileSync("fixtures/synthetic/snapshot/manifest.json", "utf8"),
    ) as { source?: { kind?: string; fixtureName?: string } };

    expect(schema.required).toContain("source");
    expect(schema.properties.source).toBeDefined();
    expect(fixtureManifest.source).toEqual({
      kind: "synthetic-fixture",
      fixtureName: "synthetic",
    });
  });

  it("defines the artifact manifest schema used by release staging", () => {
    expect(existsSync("schemas/artifact-manifest.schema.json")).toBe(true);
    const schema = JSON.parse(readFileSync("schemas/artifact-manifest.schema.json", "utf8")) as {
      required: string[];
      properties: Record<string, unknown>;
    };
    expect(schema.required).toEqual([
      "schemaVersion",
      "artifactKind",
      "artifactId",
      "createdAt",
      "source",
      "git",
      "diagnostics",
      "counts",
      "outputs",
      "probes",
    ]);
  });
});

describe("site deployment tooling", () => {
  it("deploys by staging an explicit artifact before build", () => {
    expect(sitePackageJson.scripts["stage:artifact"]).toBe("bun run scripts/stage-artifact.mjs");
    expect(sitePackageJson.scripts["build:prepared"]).toBe("vite build");
    expect(sitePackageJson.scripts["build:fixture"]).toBe(
      "bun run stage:artifact ../pipeline/artifacts/fixtures/synthetic --mode fixture && bun run build:prepared",
    );
    expect(sitePackageJson.scripts.build).toBe("bun run build:fixture");
    expect(sitePackageJson.scripts["deploy:production"]).toBe(
      "bun run scripts/deploy-production.mjs",
    );
    expect(sitePackageJson.scripts["cf-deploy"]).toBe("bun run deploy:production");
    expect(existsSync("site/scripts/stage-artifact.mjs")).toBe(true);
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

  it("stages site builds from explicit artifact directories", () => {
    expect(sitePackageJson.scripts["stage:artifact"]).toBe("bun run scripts/stage-artifact.mjs");
    expect(sitePackageJson.scripts["build:prepared"]).toBe("vite build");
    expect(sitePackageJson.scripts["build:fixture"]).toBe(
      "bun run stage:artifact ../pipeline/artifacts/fixtures/synthetic --mode fixture && bun run build:prepared",
    );
    expect(sitePackageJson.scripts.build).toBe("bun run build:fixture");
    expect(sitePackageJson.scripts["deploy:production"]).toBe(
      "bun run scripts/deploy-production.mjs",
    );
    expect(sitePackageJson.scripts["cf-deploy"]).toBe("bun run deploy:production");
  });

  it("production staging rejects fixture artifacts by manifest kind", async () => {
    const root = mkdtempSync(join(tmpdir(), "ardenfall-stage-fixture-"));
    try {
      const artifact = join(root, "artifact");
      const target = join(root, "static");
      mkdirSync(join(artifact, "assets"), { recursive: true });
      writeFileSync(
        join(artifact, "data.sqlite"),
        "not sqlite but hashed for manifest rejection order",
      );
      writeFileSync(
        join(artifact, "artifact-manifest.json"),
        JSON.stringify({
          schemaVersion: 1,
          artifactKind: "fixture",
          artifactId: "synthetic",
          createdAt: "2026-05-15T00:00:00.000Z",
          source: {
            kind: "synthetic-fixture",
            fixtureName: "synthetic",
            snapshotId: "synthetic",
            gameVersion: "fixture",
            buildIdentifier: "synthetic",
            extractorVersion: "0.1.0",
            snapshotManifestSha256: "a".repeat(64),
          },
          git: {
            repository: "glockyco/ardenfall-compendium",
            commit: "b".repeat(40),
            branch: "main",
            dirty: false,
          },
          diagnostics: { fatal: 0, diagnostic: 0 },
          counts: {},
          outputs: {
            sqlite: { path: "data.sqlite", bytes: 48, sha256: "c".repeat(64) },
            assets: { path: "assets", count: 0, treeSha256: "d".repeat(64) },
          },
          probes: { items: [{ id: "fixture", name: "Fixture", displayIconHash: null }] },
        }),
      );

      const { stageArtifact } = (await import("./site/scripts/stage-artifact.mjs")) as {
        stageArtifact: (options: {
          artifactDir: string;
          targetDir: string;
          mode: "fixture" | "release";
        }) => Promise<unknown>;
      };

      await expect(
        stageArtifact({ artifactDir: artifact, targetDir: target, mode: "release" }),
      ).rejects.toThrow(/release staging requires artifactKind release/);
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

  it("keeps prerender smoke independent of synthetic fixture names", () => {
    const smoke = readFileSync("site/scripts/smoke-prerender-output.mjs", "utf8");
    expect(smoke).not.toContain("fixture-iron-sword");
    expect(smoke).not.toContain("Iron Sword");
    expect(smoke).toContain("item_overview_rows");
  });

  it("keeps generated SQLite reads server-only", () => {
    expect(existsSync("site/src/lib/server/read-models.ts")).toBe(true);
    const readModels = readFileSync("site/src/lib/server/read-models.ts", "utf8");
    expect(readModels).toContain("better-sqlite3");
    expect(readModels).toContain('"static", "data.sqlite"');
    expect(readModels).not.toContain("$app/environment");
    expect(readModels).not.toContain("@sqlite.org/sqlite-wasm");
  });

  it("does not depend on browser SQLite for static pages", () => {
    expect(sitePackageJson.dependencies?.["@sqlite.org/sqlite-wasm"]).toBeUndefined();
    const overviewRoute = existsSync("site/src/routes/items/+page.ts")
      ? readFileSync("site/src/routes/items/+page.ts", "utf8")
      : "";
    const detailRoute = existsSync("site/src/routes/items/[id]/+page.ts")
      ? readFileSync("site/src/routes/items/[id]/+page.ts", "utf8")
      : "";
    expect(overviewRoute).not.toContain("$lib/store");
    expect(detailRoute).not.toContain("$lib/store");
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
