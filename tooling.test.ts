import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { join } from "node:path";
import { tmpdir } from "node:os";

type DecompileOptionsInput = {
  assembly: string;
  gameVersion: string;
  sha256: string;
  repoRoot: string;
  outRoot?: string;
  fullIl?: boolean;
};

type DecompileOptions = {
  assembly: string;
  gameVersion: string;
  sha256: string;
  repoRoot: string;
  outRoot: string;
  outputDir: string;
  fullIl: boolean;
};

type DecompileCommand = {
  name: string;
  args: string[];
  stdoutPath: string | null;
  allowFailure?: boolean;
};

type DecompilePlan = DecompileOptions & { commands: DecompileCommand[] };

type StageArtifactModule = {
  stageArtifact(options: {
    artifactDir: string;
    targetDir: string;
    mode: "fixture" | "release";
  }): Promise<{ manifest: object; targetDir: string }>;
};

const importModule = <T>(specifier: string) => import(specifier) as Promise<T>;
const { buildCommandPlan, defaultOptions } = await importModule<{
  buildCommandPlan(options: DecompileOptions): DecompilePlan;
  defaultOptions(options: DecompileOptionsInput): DecompileOptions;
}>("./scripts/decompile-ardenfall.ts");
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
const sitePrerenderSmoke = readFileSync("site/scripts/smoke-prerender-output.ts", "utf8");
const siteAppCss = readFileSync("site/src/app.css", "utf8");
const siteEntityTable = readFileSync("site/src/lib/components/EntityTable.svelte", "utf8");
const siteReadModels = readFileSync("site/src/lib/server/read-models.ts", "utf8");
const siteServerDb = readFileSync("site/src/lib/server/db.ts", "utf8");
const siteItemReadModels = readFileSync("site/src/lib/server/entities/item.ts", "utf8");

function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

function writeMinimalArtifactSqlite(
  sqlitePath: string,
  manifest: {
    artifactKind: string;
    artifactId: string;
    sourceKind: string;
    snapshotId: string;
    gitCommit: string;
  },
): void {
  const db = new Database(sqlitePath);
  try {
    db.exec(`
      CREATE TABLE item_overview_rows (id TEXT);
      CREATE TABLE item_presentation_rows (id TEXT);
      CREATE TABLE item_overview_filters (id TEXT);
      CREATE TABLE item_overview_categories (id TEXT);
      CREATE TABLE artifact_metadata (key TEXT, value TEXT);
    `);
    const insert = db.prepare("INSERT INTO artifact_metadata (key, value) VALUES (?, ?)");
    insert.run("artifactKind", manifest.artifactKind);
    insert.run("artifactId", manifest.artifactId);
    insert.run("sourceKind", manifest.sourceKind);
    insert.run("sourceSnapshotId", manifest.snapshotId);
    insert.run("gitCommit", manifest.gitCommit);
  } finally {
    db.close();
  }
}

function writeEmptyStatReadModelTables(sqlitePath: string): void {
  const db = new Database(sqlitePath);
  try {
    db.exec(`
      CREATE TABLE stat_type_overview_rows (id TEXT);
      CREATE TABLE stat_type_presentation_rows (id TEXT);
    `);
  } finally {
    db.close();
  }
}

function writeEmptyItemCategoryReadModelTables(sqlitePath: string): void {
  const db = new Database(sqlitePath);
  try {
    db.exec(`
      CREATE TABLE item_category_overview_rows (id TEXT);
      CREATE TABLE item_category_presentation_rows (id TEXT);
    `);
  } finally {
    db.close();
  }
}

function writeEmptyItemTagReadModelTables(sqlitePath: string): void {
  const db = new Database(sqlitePath);
  try {
    db.exec(`
      CREATE TABLE item_tag_overview_rows (id TEXT);
      CREATE TABLE item_tag_presentation_rows (id TEXT);
    `);
  } finally {
    db.close();
  }
}
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
    expect(ciWorkflow).toContain("bun test tooling.test.ts artifact-staging.test.ts");
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

  it("enforces generated validator freshness after codegen", () => {
    expect(packageJson.scripts["check:validators"]).toBe(
      "bun run codegen:validators && git diff --exit-code -- pipeline/dist/validate-*.mjs pipeline/dist/validate-*.d.mts",
    );
    expect(ciWorkflow).toContain("bun run check:validators");
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
    expect(sitePackageJson.scripts["stage:artifact"]).toBe("bun run scripts/stage-artifact.ts");
    expect(sitePackageJson.scripts["build:prepared"]).toBe("vite build && bun run build:pagefind");
    expect(sitePackageJson.scripts["build:fixture"]).toBe(
      "bun run stage:artifact ../pipeline/artifacts/fixtures/synthetic --mode fixture && bun run build:prepared",
    );
    // The default build verb must not stage fixture data, because wrangler uploads
    // whatever sits in the build directory.
    expect(sitePackageJson.scripts.build).toBe("bun run build:prepared");
    expect(sitePackageJson.scripts["deploy:production"]).toBe(
      "bun run scripts/deploy-production.ts",
    );
    expect(existsSync("site/scripts/stage-artifact.ts")).toBe(true);
    // Every deployable build runs through build:prepared, so the search index cannot
    // go missing while pages still ship.
    expect(sitePackageJson.scripts["build:pagefind"]).toBe("bun run scripts/build-pagefind.ts");
    expect(sitePackageJson.scripts["smoke:pagefind"]).toBe("bun run scripts/smoke-pagefind.ts");
    expect(existsSync("site/scripts/build-pagefind.ts")).toBe(true);
    expect(existsSync("site/scripts/smoke-pagefind.ts")).toBe(true);
    expect(sitePrerenderSmoke).toContain("WHERE o.icon_hash IS NOT NULL");
    expect(gitignore).toContain("site/_redirects");
  });

  it("stages site builds from explicit artifact directories", () => {
    expect(sitePackageJson.scripts["stage:artifact"]).toBe("bun run scripts/stage-artifact.ts");
    expect(sitePackageJson.scripts["build:prepared"]).toBe("vite build && bun run build:pagefind");
    expect(sitePackageJson.scripts["build:fixture"]).toBe(
      "bun run stage:artifact ../pipeline/artifacts/fixtures/synthetic --mode fixture && bun run build:prepared",
    );
    // The default build verb must not stage fixture data, because wrangler uploads
    // whatever sits in the build directory.
    expect(sitePackageJson.scripts.build).toBe("bun run build:prepared");
    expect(sitePackageJson.scripts["deploy:production"]).toBe(
      "bun run scripts/deploy-production.ts",
    );
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

      const { stageArtifact } = await importModule<StageArtifactModule>(
        "./site/scripts/stage-artifact.ts",
      );

      await expect(
        stageArtifact({ artifactDir: artifact, targetDir: target, mode: "release" }),
      ).rejects.toThrow(/release staging requires artifactKind release/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects missing redirects before mutating target files", async () => {
    const root = mkdtempSync(join(tmpdir(), "ardenfall-stage-missing-redirects-"));
    try {
      const artifact = join(root, "artifact");
      const target = join(root, "static");
      const source = {
        kind: "synthetic-fixture",
        fixtureName: "synthetic",
        snapshotId: "synthetic",
        gameVersion: "fixture",
        buildIdentifier: "synthetic",
        extractorVersion: "0.1.0",
        snapshotManifestSha256: "a".repeat(64),
      };
      const git = {
        repository: "glockyco/ardenfall-compendium",
        commit: "b".repeat(40),
        branch: "main",
        dirty: false,
      };
      mkdirSync(join(artifact, "assets"), { recursive: true });
      mkdirSync(join(target, "assets"), { recursive: true });
      writeFileSync(join(target, "data.sqlite"), "previous sqlite");
      writeFileSync(join(target, "_redirects"), "previous redirects");
      writeFileSync(join(target, "assets", "stale.webp"), "stale asset");

      const sqlitePath = join(artifact, "data.sqlite");
      writeMinimalArtifactSqlite(sqlitePath, {
        artifactKind: "fixture",
        artifactId: "synthetic",
        sourceKind: source.kind,
        snapshotId: source.snapshotId,
        gitCommit: git.commit,
      });
      writeEmptyStatReadModelTables(sqlitePath);
      writeEmptyItemCategoryReadModelTables(sqlitePath);
      writeEmptyItemTagReadModelTables(sqlitePath);
      const sqliteBytes = readFileSync(sqlitePath);
      writeFileSync(
        join(artifact, "artifact-manifest.json"),
        JSON.stringify({
          schemaVersion: 1,
          artifactKind: "fixture",
          artifactId: "synthetic",
          createdAt: "2026-05-15T00:00:00.000Z",
          source,
          git,
          diagnostics: { fatal: 0, diagnostic: 0 },
          counts: {
            itemOverviewRows: 0,
            itemPresentationRows: 0,
            itemOverviewFilters: 0,
            itemOverviewCategories: 0,
            statTypeOverviewRows: 0,
            statTypePresentationRows: 0,
            itemCategoryOverviewRows: 0,
            itemCategoryPresentationRows: 0,
            itemTagOverviewRows: 0,
            itemTagPresentationRows: 0,
          },
          outputs: {
            sqlite: {
              path: "data.sqlite",
              bytes: sqliteBytes.byteLength,
              sha256: sha256(sqliteBytes),
            },
            assets: { path: "assets", count: 0, treeSha256: sha256("") },
          },
          probes: { items: [{ id: "fixture", name: "Fixture", displayIconHash: null }] },
        }),
      );

      const { stageArtifact } = await importModule<StageArtifactModule>(
        "./site/scripts/stage-artifact.ts",
      );

      await expect(
        stageArtifact({ artifactDir: artifact, targetDir: target, mode: "fixture" }),
      ).rejects.toThrow(/missing redirects artifact/);
      expect(readFileSync(join(target, "data.sqlite"), "utf8")).toBe("previous sqlite");
      expect(readFileSync(join(target, "_redirects"), "utf8")).toBe("previous redirects");
      expect(readFileSync(join(target, "assets", "stale.webp"), "utf8")).toBe("stale asset");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("stages redirects at the Cloudflare adapter project root", async () => {
    const root = mkdtempSync(join(tmpdir(), "ardenfall-stage-root-redirects-"));
    try {
      const artifact = join(root, "artifact");
      const projectRoot = join(root, "site");
      const target = join(projectRoot, "static");
      const source = {
        kind: "synthetic-fixture",
        fixtureName: "synthetic",
        snapshotId: "synthetic",
        gameVersion: "fixture",
        buildIdentifier: "synthetic",
        extractorVersion: "0.1.0",
        snapshotManifestSha256: "a".repeat(64),
      };
      const git = {
        repository: "glockyco/ardenfall-compendium",
        commit: "b".repeat(40),
        branch: "main",
        dirty: false,
      };
      mkdirSync(join(artifact, "assets"), { recursive: true });
      mkdirSync(join(artifact, "static"), { recursive: true });
      mkdirSync(target, { recursive: true });
      writeFileSync(join(artifact, "static", "_redirects"), "# generated redirects\n");
      writeFileSync(join(projectRoot, "_redirects"), "stale root redirects");
      writeFileSync(join(target, "_redirects"), "stale static redirects");

      const sqlitePath = join(artifact, "data.sqlite");
      writeMinimalArtifactSqlite(sqlitePath, {
        artifactKind: "fixture",
        artifactId: "synthetic",
        sourceKind: source.kind,
        snapshotId: source.snapshotId,
        gitCommit: git.commit,
      });
      writeEmptyStatReadModelTables(sqlitePath);
      writeEmptyItemCategoryReadModelTables(sqlitePath);
      writeEmptyItemTagReadModelTables(sqlitePath);
      const sqliteBytes = readFileSync(sqlitePath);
      writeFileSync(
        join(artifact, "artifact-manifest.json"),
        JSON.stringify({
          schemaVersion: 1,
          artifactKind: "fixture",
          artifactId: "synthetic",
          createdAt: "2026-05-15T00:00:00.000Z",
          source,
          git,
          diagnostics: { fatal: 0, diagnostic: 0 },
          counts: {
            itemOverviewRows: 0,
            itemPresentationRows: 0,
            itemOverviewFilters: 0,
            itemOverviewCategories: 0,
            statTypeOverviewRows: 0,
            statTypePresentationRows: 0,
            itemCategoryOverviewRows: 0,
            itemCategoryPresentationRows: 0,
            itemTagOverviewRows: 0,
            itemTagPresentationRows: 0,
          },
          outputs: {
            sqlite: {
              path: "data.sqlite",
              bytes: sqliteBytes.byteLength,
              sha256: sha256(sqliteBytes),
            },
            assets: { path: "assets", count: 0, treeSha256: sha256("") },
          },
          probes: { items: [{ id: "fixture", name: "Fixture", displayIconHash: null }] },
        }),
      );

      const { stageArtifact } = await importModule<StageArtifactModule>(
        "./site/scripts/stage-artifact.ts",
      );

      await stageArtifact({ artifactDir: artifact, targetDir: target, mode: "fixture" });

      expect(readFileSync(join(projectRoot, "_redirects"), "utf8")).toBe("# generated redirects\n");
      expect(existsSync(join(target, "_redirects"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects artifacts that omit stat read-model counts", async () => {
    const root = mkdtempSync(join(tmpdir(), "ardenfall-stage-missing-stat-counts-"));
    try {
      const artifact = join(root, "artifact");
      const target = join(root, "site", "static");
      const source = {
        kind: "synthetic-fixture",
        fixtureName: "synthetic",
        snapshotId: "synthetic",
        gameVersion: "fixture",
        buildIdentifier: "synthetic",
        extractorVersion: "0.1.0",
        snapshotManifestSha256: "a".repeat(64),
      };
      const git = {
        repository: "glockyco/ardenfall-compendium",
        commit: "b".repeat(40),
        branch: "main",
        dirty: false,
      };
      mkdirSync(join(artifact, "assets"), { recursive: true });
      mkdirSync(join(artifact, "static"), { recursive: true });
      writeFileSync(join(artifact, "static", "_redirects"), "# redirects\n");

      const sqlitePath = join(artifact, "data.sqlite");
      writeMinimalArtifactSqlite(sqlitePath, {
        artifactKind: "fixture",
        artifactId: "synthetic",
        sourceKind: source.kind,
        snapshotId: source.snapshotId,
        gitCommit: git.commit,
      });
      const db = new Database(sqlitePath);
      try {
        db.exec(`
          CREATE TABLE stat_type_overview_rows (id TEXT);
          CREATE TABLE stat_type_presentation_rows (id TEXT);
        `);
      } finally {
        db.close();
      }
      const sqliteBytes = readFileSync(sqlitePath);
      writeFileSync(
        join(artifact, "artifact-manifest.json"),
        JSON.stringify({
          schemaVersion: 1,
          artifactKind: "fixture",
          artifactId: "synthetic",
          createdAt: "2026-05-15T00:00:00.000Z",
          source,
          git,
          diagnostics: { fatal: 0, diagnostic: 0 },
          counts: {
            itemOverviewRows: 0,
            itemPresentationRows: 0,
            itemOverviewFilters: 0,
            itemOverviewCategories: 0,
          },
          outputs: {
            sqlite: {
              path: "data.sqlite",
              bytes: sqliteBytes.byteLength,
              sha256: sha256(sqliteBytes),
            },
            assets: { path: "assets", count: 0, treeSha256: sha256("") },
          },
          probes: { items: [{ id: "fixture", name: "Fixture", displayIconHash: null }] },
        }),
      );

      const { stageArtifact } = await importModule<StageArtifactModule>(
        "./site/scripts/stage-artifact.ts",
      );

      await expect(
        stageArtifact({ artifactDir: artifact, targetDir: target, mode: "fixture" }),
      ).rejects.toThrow(/missing required count statTypeOverviewRows/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects artifacts that omit stat read-model tables", async () => {
    const root = mkdtempSync(join(tmpdir(), "ardenfall-stage-missing-stat-tables-"));
    try {
      const artifact = join(root, "artifact");
      const target = join(root, "site", "static");
      const source = {
        kind: "synthetic-fixture",
        fixtureName: "synthetic",
        snapshotId: "synthetic",
        gameVersion: "fixture",
        buildIdentifier: "synthetic",
        extractorVersion: "0.1.0",
        snapshotManifestSha256: "a".repeat(64),
      };
      const git = {
        repository: "glockyco/ardenfall-compendium",
        commit: "b".repeat(40),
        branch: "main",
        dirty: false,
      };
      mkdirSync(join(artifact, "assets"), { recursive: true });
      mkdirSync(join(artifact, "static"), { recursive: true });
      writeFileSync(join(artifact, "static", "_redirects"), "# redirects\n");

      const sqlitePath = join(artifact, "data.sqlite");
      writeMinimalArtifactSqlite(sqlitePath, {
        artifactKind: "fixture",
        artifactId: "synthetic",
        sourceKind: source.kind,
        snapshotId: source.snapshotId,
        gitCommit: git.commit,
      });
      const sqliteBytes = readFileSync(sqlitePath);
      writeFileSync(
        join(artifact, "artifact-manifest.json"),
        JSON.stringify({
          schemaVersion: 1,
          artifactKind: "fixture",
          artifactId: "synthetic",
          createdAt: "2026-05-15T00:00:00.000Z",
          source,
          git,
          diagnostics: { fatal: 0, diagnostic: 0 },
          counts: {
            itemOverviewRows: 0,
            itemPresentationRows: 0,
            itemOverviewFilters: 0,
            itemOverviewCategories: 0,
            statTypeOverviewRows: 0,
            statTypePresentationRows: 0,
          },
          outputs: {
            sqlite: {
              path: "data.sqlite",
              bytes: sqliteBytes.byteLength,
              sha256: sha256(sqliteBytes),
            },
            assets: { path: "assets", count: 0, treeSha256: sha256("") },
          },
          probes: { items: [{ id: "fixture", name: "Fixture", displayIconHash: null }] },
        }),
      );

      const { stageArtifact } = await importModule<StageArtifactModule>(
        "./site/scripts/stage-artifact.ts",
      );

      await expect(
        stageArtifact({ artifactDir: artifact, targetDir: target, mode: "fixture" }),
      ).rejects.toThrow(/missing sqlite table stat_type_overview_rows/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("validates stat read-model counts while staging artifacts", async () => {
    const root = mkdtempSync(join(tmpdir(), "ardenfall-stage-stat-counts-"));
    try {
      const artifact = join(root, "artifact");
      const target = join(root, "site", "static");
      const source = {
        kind: "synthetic-fixture",
        fixtureName: "synthetic",
        snapshotId: "synthetic",
        gameVersion: "fixture",
        buildIdentifier: "synthetic",
        extractorVersion: "0.1.0",
        snapshotManifestSha256: "a".repeat(64),
      };
      const git = {
        repository: "glockyco/ardenfall-compendium",
        commit: "b".repeat(40),
        branch: "main",
        dirty: false,
      };
      mkdirSync(join(artifact, "assets"), { recursive: true });
      mkdirSync(join(artifact, "static"), { recursive: true });
      writeFileSync(join(artifact, "static", "_redirects"), "# redirects\n");

      const sqlitePath = join(artifact, "data.sqlite");
      writeMinimalArtifactSqlite(sqlitePath, {
        artifactKind: "fixture",
        artifactId: "synthetic",
        sourceKind: source.kind,
        snapshotId: source.snapshotId,
        gitCommit: git.commit,
      });
      const db = new Database(sqlitePath);
      try {
        db.exec(`
          CREATE TABLE stat_type_overview_rows (id TEXT);
          INSERT INTO stat_type_overview_rows VALUES ('stat-strength');
          CREATE TABLE stat_type_presentation_rows (id TEXT);
          INSERT INTO stat_type_presentation_rows VALUES ('stat-strength');
        `);
      } finally {
        db.close();
      }
      const sqliteBytes = readFileSync(sqlitePath);
      writeFileSync(
        join(artifact, "artifact-manifest.json"),
        JSON.stringify({
          schemaVersion: 1,
          artifactKind: "fixture",
          artifactId: "synthetic",
          createdAt: "2026-05-15T00:00:00.000Z",
          source,
          git,
          diagnostics: { fatal: 0, diagnostic: 0 },
          counts: {
            itemOverviewRows: 0,
            itemPresentationRows: 0,
            itemOverviewFilters: 0,
            itemOverviewCategories: 0,
            statTypeOverviewRows: 2,
            statTypePresentationRows: 1,
          },
          outputs: {
            sqlite: {
              path: "data.sqlite",
              bytes: sqliteBytes.byteLength,
              sha256: sha256(sqliteBytes),
            },
            assets: { path: "assets", count: 0, treeSha256: sha256("") },
          },
          probes: { items: [{ id: "fixture", name: "Fixture", displayIconHash: null }] },
        }),
      );

      const { stageArtifact } = await importModule<StageArtifactModule>(
        "./site/scripts/stage-artifact.ts",
      );

      await expect(
        stageArtifact({ artifactDir: artifact, targetDir: target, mode: "fixture" }),
      ).rejects.toThrow(/statTypeOverviewRows mismatch/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("requires small-entity read-model counts while staging artifacts", () => {
    const stage = readFileSync("site/scripts/stage-artifact.ts", "utf8");

    expect(stage).toContain('"itemCategoryOverviewRows"');
    expect(stage).toContain('"item_category_overview_rows"');
    expect(stage).toContain('"itemCategoryPresentationRows"');
    expect(stage).toContain('"item_category_presentation_rows"');
    expect(stage).toContain('"itemTagOverviewRows"');
    expect(stage).toContain('"item_tag_overview_rows"');
    expect(stage).toContain('"itemTagPresentationRows"');
    expect(stage).toContain('"item_tag_presentation_rows"');
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

  it("deploys files only, with no Worker in front of them", () => {
    // A Worker used to sit here and could only fail, because its bundle pulled in the server
    // modules that read the build database. It answered 500 for any address that matched no file.
    expect(siteSvelteConfig).toContain("@sveltejs/adapter-static");
    expect(siteWranglerConfig).toContain('directory = ".svelte-kit/cloudflare"');
    expect(siteWranglerConfig).not.toMatch(/^main\s*=/m);
    expect(siteWranglerConfig).not.toMatch(/^run_worker_first\s*=/m);
  });

  it("serves its own 404 page when an address matches no file", () => {
    expect(siteWranglerConfig).toContain('not_found_handling = "404-page"');
    expect(existsSync("site/src/routes/404/+page.svelte")).toBe(true);
  });

  it("has a prerender smoke script wired into the site package", () => {
    expect(sitePackageJson.scripts["smoke:prerender"]).toBe(
      "bun run scripts/smoke-prerender-output.ts",
    );
  });

  it("defines popover color tokens for opaque overlay surfaces", () => {
    expect(siteAppCss).toContain("--color-popover: var(--popover)");
    expect(siteAppCss).toContain("--color-popover-foreground: var(--popover-foreground)");
    expect(siteAppCss).toContain("--popover:");
    expect(siteAppCss).toContain("--popover-foreground:");
  });

  it("documents release artifact provenance as the deploy contract", () => {
    const readme = readFileSync("README.md", "utf8");
    // The agent-facing home for this rule is `.omp/RULES.md`, which the harness reattaches
    // near the current turn. `AGENTS.md` is opening context that compaction can drop, so a
    // rule this expensive to violate belongs on the sticky surface instead.
    const rules = readFileSync(".omp/RULES.md", "utf8");

    for (const text of [rules, readme]) {
      expect(text).toContain("artifact-manifest.json");
      expect(text).toContain("site/static");
      expect(text).toContain("staging cache");
    }

    expect(readme).toContain("bun run artifact:fixture synthetic fixtures/synthetic/snapshot");
    expect(readme).toContain("bun run artifact:release snapshots/snapshots/<snapshot-id>");
    expect(readme).toContain(
      "bun run --cwd site deploy:production ../pipeline/artifacts/releases/<snapshot-id>",
    );
  });

  it("keeps prerender smoke independent of synthetic fixture names", () => {
    const smoke = readFileSync("site/scripts/smoke-prerender-output.ts", "utf8");
    expect(smoke).not.toContain("fixture-iron-sword");
    expect(smoke).not.toContain("Iron Sword");
    expect(smoke).toContain("manifest.probes.items");
  });

  it("requires an icon-bearing stat prerender smoke probe", () => {
    const smoke = readFileSync("site/scripts/smoke-prerender-output.ts", "utf8");

    expect(smoke).toContain("WHERE o.icon_hash IS NOT NULL");
    expect(smoke).toContain(
      'throw new Error("staged artifact contains no icon-bearing stat-type probe")',
    );
    expect(smoke).not.toContain("if (statProbe.icon_hash &&");
    expect(smoke).toContain("missing stat probe asset");
    expect(smoke).not.toContain("melee-damage");
  });

  it("requires small-entity prerender smoke probes", () => {
    const smoke = readFileSync("site/scripts/smoke-prerender-output.ts", "utf8");

    expect(smoke).toContain("readItemCategoryProbe()");
    expect(smoke).toContain("item_category_overview_rows");
    expect(smoke).toContain("missing category probe asset");
    expect(smoke).toContain("category detail HTML missing item");
    expect(smoke).toContain("readItemTagProbe()");
    expect(smoke).toContain("item_tag_overview_rows");
    expect(smoke).toContain("tag detail HTML missing item");
    expect(smoke).not.toContain("fixture-weapons");
    expect(smoke).not.toContain("fixture-tag-valuable-remedy");
    expect(smoke).not.toContain("Iron Sword");
  });

  it("catalogs small-entity page components", () => {
    const catalog = JSON.parse(readFileSync("site/src/lib/components/COMPONENTS.json", "utf8")) as {
      components: Array<{ id: string; path: string; layer: string }>;
    };

    expect(catalog.components).toContainEqual({
      id: "categories.ItemCategoryOverview",
      path: "categories/ItemCategoryOverview.svelte",
      layer: "categories",
    });
    expect(catalog.components).toContainEqual({
      id: "categories.ItemCategoryDetail",
      path: "categories/ItemCategoryDetail.svelte",
      layer: "categories",
    });
    expect(catalog.components).toContainEqual({
      id: "tags.ItemTagOverview",
      path: "tags/ItemTagOverview.svelte",
      layer: "tags",
    });
    expect(catalog.components).toContainEqual({
      id: "tags.ItemTagDetail",
      path: "tags/ItemTagDetail.svelte",
      layer: "tags",
    });
  });

  it("uses release metadata for local and production smokes", () => {
    const localSmoke = readFileSync("site/scripts/smoke-prerender-output.ts", "utf8");
    expect(localSmoke).toContain("_release.json");
    expect(localSmoke).toContain("manifest.probes.items");

    expect(existsSync("site/scripts/smoke-production-release.ts")).toBe(true);
    const remoteSmoke = readFileSync("site/scripts/smoke-production-release.ts", "utf8");
    expect(remoteSmoke).toContain("/_release.json");
    expect(remoteSmoke).toContain("source.snapshotManifestSha256");

    const deploy = readFileSync("site/scripts/deploy-production.ts", "utf8");
    expect(deploy).toContain("stageArtifact");
    expect(deploy).toContain("wrangler deploy");
    expect(deploy).toContain("smoke-production-release.ts");
  });

  it("does not bulk-attach full item presentation rows to the item overview payload", () => {
    expect(siteReadModels).not.toContain("attachItemTooltips");
    expect(siteItemReadModels).not.toContain("attachItemTooltips");
    expect(siteReadModels).not.toContain("SELECT * FROM item_presentation_rows WHERE id IN");
    expect(siteItemReadModels).not.toContain("SELECT * FROM item_presentation_rows WHERE id IN");
    expect(siteEntityTable).not.toContain("ItemTooltipCard");
    expect(siteEntityTable).not.toContain("ItemPresentationRow");
  });
  it("keeps generated SQLite reads server-only", () => {
    expect(existsSync("site/src/lib/server/read-models.ts")).toBe(true);
    expect(existsSync("site/src/lib/server/db.ts")).toBe(true);
    expect(siteServerDb).toContain("better-sqlite3");
    expect(siteServerDb).toContain('".data", "data.sqlite"');
    expect(siteReadModels).not.toContain("$app/environment");
    expect(siteServerDb).not.toContain("$app/environment");
    expect(siteReadModels).not.toContain("@sqlite.org/sqlite-wasm");
    expect(siteServerDb).not.toContain("@sqlite.org/sqlite-wasm");
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
    expect(packageJson.scripts["decompile:game"]).toBe("bun run scripts/decompile-ardenfall.ts");
    expect(existsSync("scripts/decompile-ardenfall.ts")).toBe(true);
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
