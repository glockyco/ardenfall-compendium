---
title: "Artifact Provenance Release Implementation Plan"
type: plan
status: implemented
created: 2026-05-15
parent: 2026-05-15-artifact-provenance-release-design
superseded_by:
archived: 2026-06-25
---

# Artifact Provenance Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Ardenfall production deploys consume only explicit, provenance-bearing release artifacts while preserving fast synthetic fixture site builds.

**Architecture:** The pipeline emits typed artifacts under `pipeline/artifacts/fixtures/<name>/` or `pipeline/artifacts/releases/<snapshot-id>/`, each with `artifact-manifest.json`, `data.sqlite`, and `assets/`. Site build/deploy stages one explicit artifact into `site/static`, validates hashes and SQLite metadata, publishes `/_release.json`, and deploys only release artifacts to Cloudflare.

**Tech Stack:** Bun, TypeScript pipeline stages, JSON Schema 2020-12 validators, `bun:sqlite`, SvelteKit prerendering, Cloudflare Workers Static Assets, Wrangler.

---

## Source-grounded constraints

- Design spec: `docs/superpowers/specs/2026-05-15-artifact-provenance-release-design.md`.
- `site/static` is a staging cache only; it is not source-of-truth.
- Synthetic fixtures remain first-class test artifacts, but production deploy scripts must reject them by manifest identity, not row-count heuristics.
- `pipeline/dist` must stop being a production deploy input.
- Release manifests must include Git commit, source snapshot identity, artifact hashes, exact counts, and release probes.
- Public `/_release.json` must omit local paths, usernames, hostnames, and secrets.

## Files and responsibilities

- `schemas/manifest.schema.json` — add snapshot `source` provenance.
- `schemas/artifact-manifest.schema.json` — validate emitted artifact manifests.
- `pipeline/src/types.ts` — TypeScript types for snapshot source and artifact manifests.
- `pipeline/src/artifacts/hash.ts` — deterministic SHA-256 helpers for files, JSON, and asset trees.
- `pipeline/src/artifacts/manifest.ts` — build and validate artifact manifests from pipeline outputs.
- `pipeline/src/artifacts/verify.ts` — reusable artifact verification for site staging and tests.
- `pipeline/src/cli.ts` — split ambiguous `run` into `build-fixture` and `build-release` commands.
- `pipeline/src/stages/emit-sqlite.ts` — write `artifact_metadata` table into generated SQLite.
- `mod/src/Dtos/Manifest.cs`, `mod/src/Emit/ManifestBuilder.cs`, `mod/src/Extraction/ExtractionService.cs`, `mod/src/Control/Handlers/RunFinalizeCommand.cs` — add live-export source provenance to real snapshot manifests.
- `fixtures/synthetic/snapshot/manifest.json` — mark synthetic fixture source provenance.
- `fixtures/synthetic/manifest.json` — update hash for the changed fixture snapshot manifest.
- `site/scripts/stage-artifact.mjs` — clean and stage a validated artifact into `site/static`, writing `_release.json`.
- `site/scripts/smoke-prerender-output.mjs` — assert built static output matches staged release metadata.
- `site/scripts/deploy-production.mjs` — validate, stage, build, smoke, deploy, and print Cloudflare version.
- `site/package.json`, `package.json` — intent-specific scripts.
- `.github/workflows/ci.yml` — fixture CI writes fixture artifacts, not deploy artifacts.
- `tooling.test.ts`, `pipeline/test/*`, `mod-tests/*` — guardrails and red-green coverage.
- `AGENTS.md`, `site/AGENTS.md`, `README.md`, `docs/superpowers/roadmap.md` — document the release artifact contract.

---

### Task 1: Snapshot source provenance

**Files:**

- Modify: `schemas/manifest.schema.json`
- Modify: `pipeline/src/types.ts`
- Modify: `fixtures/synthetic/snapshot/manifest.json`
- Modify: `fixtures/synthetic/manifest.json`
- Modify: `mod/src/Dtos/Manifest.cs`
- Modify: `mod/src/Emit/ManifestBuilder.cs`
- Modify: `mod/src/Extraction/ExtractionService.cs`
- Modify: `mod/src/Control/Handlers/RunFinalizeCommand.cs`
- Test: `tooling.test.ts`
- Test: `mod-tests/RunFinalizeCommandTests.cs`

- [ ] **Step 1: Write failing schema/tooling test for snapshot source provenance**

Add to `tooling.test.ts` near existing manifest/schema tests:

```ts
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
```

- [ ] **Step 2: Run the failing test**

Run:

```sh
bun test tooling.test.ts -t "requires snapshot manifests to declare source provenance"
```

Expected: FAIL because `schemas/manifest.schema.json` does not require `source` and fixture manifest lacks `source`.

- [ ] **Step 3: Update snapshot manifest schema**

In `schemas/manifest.schema.json`, add `"source"` to `required` and add this property:

```json
"source": {
  "oneOf": [
    {
      "type": "object",
      "additionalProperties": false,
      "required": ["kind"],
      "properties": {
        "kind": { "const": "live-game-export" }
      }
    },
    {
      "type": "object",
      "additionalProperties": false,
      "required": ["kind", "fixtureName"],
      "properties": {
        "kind": { "const": "synthetic-fixture" },
        "fixtureName": { "type": "string", "minLength": 1 }
      }
    }
  ]
}
```

- [ ] **Step 4: Update pipeline types**

In `pipeline/src/types.ts`, add:

```ts
export type SnapshotSource =
  | { kind: "live-game-export" }
  | { kind: "synthetic-fixture"; fixtureName: string };
```

Then add this field to `SnapshotManifest`:

```ts
source: SnapshotSource;
```

- [ ] **Step 5: Update synthetic fixture manifest and fixture hash envelope**

In `fixtures/synthetic/snapshot/manifest.json`, add after `extractedAt`:

```json
"source": {
  "kind": "synthetic-fixture",
  "fixtureName": "synthetic"
},
```

Recompute the SHA-256 of `fixtures/synthetic/snapshot/manifest.json` and update `fixtures/synthetic/manifest.json` key `snapshot/manifest.json`.

Use:

```sh
bun -e 'const text = await Bun.file("fixtures/synthetic/snapshot/manifest.json").text(); console.log(new Bun.CryptoHasher("sha256").update(text).digest("hex"));'
```

- [ ] **Step 6: Update mod manifest DTOs and builders**

In `mod/src/Dtos/Manifest.cs`, add:

```csharp
public sealed class SnapshotSource
{
    [JsonProperty("kind")] public string Kind { get; init; } = "";
}
```

Add this property to `Manifest`:

```csharp
[JsonProperty("source")] public SnapshotSource Source { get; init; } = new();
```

In `mod/src/Emit/ManifestBuilder.cs`, set `Source` inside the `new Manifest` initializer returned by `Build`:

```csharp
Source = new SnapshotSource { Kind = "live-game-export" },
```

Do not expose local paths or operator identity.

- [ ] **Step 7: Run schema/codegen and tests**

Run:

```sh
bun run codegen:validators
bun test tooling.test.ts -t "requires snapshot manifests to declare source provenance"
dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --filter RunFinalizeCommandTests
```

Expected: tooling test passes; mod finalize tests fail if their manifest JSON assertions do not include the new `source` field.

- [ ] **Step 8: Update manifest assertions in mod tests**

In each `RunFinalizeCommandTests` assertion that reads or compares manifest JSON, assert the source explicitly:

```csharp
Assert.Equal("live-game-export", manifest.Source.Kind);
```

Run the same `dotnet test` command again. Expected: PASS.

- [ ] **Step 9: Commit**

```sh
git add schemas/manifest.schema.json pipeline/src/types.ts fixtures/synthetic/snapshot/manifest.json fixtures/synthetic/manifest.json mod/src/Dtos/Manifest.cs mod/src/Emit/ManifestBuilder.cs mod/src/Extraction/ExtractionService.cs mod/src/Control/Handlers/RunFinalizeCommand.cs mod-tests/RunFinalizeCommandTests.cs tooling.test.ts pipeline/dist
git commit -m "feat(pipeline): record snapshot source provenance"
```

---

### Task 2: Artifact manifest schema and hash helpers

**Files:**

- Create: `schemas/artifact-manifest.schema.json`
- Create: `pipeline/src/artifacts/hash.ts`
- Modify: `pipeline/src/types.ts`
- Modify: `package.json`
- Test: `tooling.test.ts`
- Test: `pipeline/test/artifact-hash.test.ts`

- [ ] **Step 1: Write failing schema guard test**

Add to `tooling.test.ts`:

```ts
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
```

- [ ] **Step 2: Write failing hash helper tests**

Create `pipeline/test/artifact-hash.test.ts`:

```ts
import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { sha256File, sha256Json, sha256Tree } from "../src/artifacts/hash";

describe("artifact hash helpers", () => {
  it("hashes JSON deterministically by its serialized bytes", () => {
    expect(sha256Json({ b: 2, a: 1 })).toBe(
      "43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777",
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
        "b08985c5a646ba1b1fd78c1f0f0518cc07c4d79cb479625266b764f6ec20d31f",
      );
      expect(await sha256Tree(join(root, "assets"))).toBe(
        "e4b071435d7a4e8cdd247c980b89350f2d0527b1770e710d66ab2eab9b64828f",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 3: Run failing tests**

Run:

```sh
bun test tooling.test.ts -t "defines the artifact manifest schema"
bun test pipeline/test/artifact-hash.test.ts
```

Expected: FAIL because schema and hash helper module do not exist.

- [ ] **Step 4: Create artifact manifest schema**

Create `schemas/artifact-manifest.schema.json` with this complete schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://ardenfall-compendium.example/schemas/artifact-manifest.schema.json",
  "title": "Generated artifact manifest",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schemaVersion",
    "artifactKind",
    "artifactId",
    "createdAt",
    "source",
    "git",
    "diagnostics",
    "counts",
    "outputs",
    "probes"
  ],
  "properties": {
    "schemaVersion": { "type": "integer", "minimum": 1 },
    "artifactKind": { "enum": ["fixture", "release"] },
    "artifactId": { "type": "string", "minLength": 1 },
    "createdAt": { "type": "string", "format": "date-time" },
    "source": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "kind",
        "snapshotId",
        "gameVersion",
        "buildIdentifier",
        "extractorVersion",
        "snapshotManifestSha256"
      ],
      "properties": {
        "kind": { "enum": ["live-game-export", "synthetic-fixture"] },
        "fixtureName": { "type": "string", "minLength": 1 },
        "snapshotId": { "type": "string", "minLength": 1 },
        "gameVersion": { "type": "string", "minLength": 1 },
        "buildIdentifier": { "type": "string", "minLength": 1 },
        "extractorVersion": { "type": "string", "minLength": 1 },
        "snapshotManifestSha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }
      }
    },
    "git": {
      "type": "object",
      "additionalProperties": false,
      "required": ["repository", "commit", "branch", "dirty"],
      "properties": {
        "repository": { "type": "string", "minLength": 1 },
        "commit": { "type": "string", "pattern": "^[a-f0-9]{40}$" },
        "branch": { "type": "string", "minLength": 1 },
        "dirty": { "type": "boolean" }
      }
    },
    "toolchain": {
      "type": "object",
      "additionalProperties": { "type": "string" }
    },
    "diagnostics": {
      "type": "object",
      "additionalProperties": false,
      "required": ["fatal", "diagnostic"],
      "properties": {
        "fatal": { "type": "integer", "minimum": 0 },
        "diagnostic": { "type": "integer", "minimum": 0 }
      }
    },
    "counts": {
      "type": "object",
      "additionalProperties": { "type": "integer", "minimum": 0 }
    },
    "outputs": {
      "type": "object",
      "additionalProperties": false,
      "required": ["sqlite", "assets"],
      "properties": {
        "sqlite": {
          "type": "object",
          "additionalProperties": false,
          "required": ["path", "bytes", "sha256"],
          "properties": {
            "path": { "const": "data.sqlite" },
            "bytes": { "type": "integer", "minimum": 1 },
            "sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }
          }
        },
        "assets": {
          "type": "object",
          "additionalProperties": false,
          "required": ["path", "count", "treeSha256"],
          "properties": {
            "path": { "const": "assets" },
            "count": { "type": "integer", "minimum": 0 },
            "treeSha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }
          }
        }
      }
    },
    "probes": {
      "type": "object",
      "additionalProperties": false,
      "required": ["items"],
      "properties": {
        "items": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["id", "name"],
            "properties": {
              "id": { "type": "string", "minLength": 1 },
              "name": { "type": "string", "minLength": 1 },
              "displayIconHash": { "type": ["string", "null"], "pattern": "^[a-f0-9]{64}$" }
            }
          }
        }
      }
    }
  }
}
```

- [ ] **Step 5: Add artifact manifest types**

Add to `pipeline/src/types.ts`:

```ts
export type ArtifactKind = "fixture" | "release";

export interface ArtifactManifest {
  schemaVersion: number;
  artifactKind: ArtifactKind;
  artifactId: string;
  createdAt: string;
  source: {
    kind: "live-game-export" | "synthetic-fixture";
    fixtureName?: string;
    snapshotId: string;
    gameVersion: string;
    buildIdentifier: string;
    extractorVersion: string;
    snapshotManifestSha256: string;
  };
  git: {
    repository: string;
    commit: string;
    branch: string;
    dirty: boolean;
  };
  toolchain?: Record<string, string>;
  diagnostics: { fatal: number; diagnostic: number };
  counts: Record<string, number>;
  outputs: {
    sqlite: { path: "data.sqlite"; bytes: number; sha256: string };
    assets: { path: "assets"; count: number; treeSha256: string };
  };
  probes: { items: { id: string; name: string; displayIconHash: string | null }[] };
}
```

- [ ] **Step 6: Implement hash helpers**

Create `pipeline/src/artifacts/hash.ts`:

```ts
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export function sha256Bytes(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function sha256Json(value: unknown): string {
  return sha256Bytes(JSON.stringify(value));
}

export async function sha256File(path: string): Promise<string> {
  return sha256Bytes(readFileSync(path));
}

export async function sha256Tree(root: string): Promise<string> {
  const entries = listFiles(root).map((path) => {
    const rel = relative(root, path).replaceAll("\\\\", "/");
    const hash = sha256Bytes(readFileSync(path));
    return `${rel}\0${hash}`;
  });
  return sha256Bytes(entries.join("\n"));
}

function listFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...listFiles(path));
    else if (entry.isFile()) {
      const info = statSync(path);
      if (info.size === 0) throw new Error(`refusing to hash empty artifact file: ${path}`);
      results.push(path);
    }
  }
  return results.sort();
}
```

- [ ] **Step 7: Wire codegen for the new schema**

Add `{ schema: "schemas/artifact-manifest.schema.json", out: "pipeline/dist/validate-artifact-manifest.mjs" }` to the `targets` array in `pipeline/scripts/codegen-validators.ts`.

Run:

```sh
bun run codegen:validators
```

Expected: `pipeline/dist/validate-artifact-manifest.mjs` exists.

- [ ] **Step 8: Verify tests pass**

Run:

```sh
bun test tooling.test.ts -t "defines the artifact manifest schema"
bun test pipeline/test/artifact-hash.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```sh
git add schemas/artifact-manifest.schema.json pipeline/src/artifacts/hash.ts pipeline/src/types.ts pipeline/test/artifact-hash.test.ts tooling.test.ts package.json pipeline/scripts/codegen-validators.ts pipeline/dist
git commit -m "feat(pipeline): define artifact manifest contract"
```

---

### Task 3: Emit release and fixture artifact manifests

**Files:**

- Create: `pipeline/src/artifacts/manifest.ts`
- Modify: `pipeline/src/stages/emit-sqlite.ts`
- Modify: `pipeline/src/cli.ts`
- Test: `pipeline/test/artifact-manifest.test.ts`

- [ ] **Step 1: Write failing artifact manifest tests**

Create `pipeline/test/artifact-manifest.test.ts`:

```ts
import { Database } from "bun:sqlite";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { buildArtifactManifest } from "../src/artifacts/manifest";
import type { LoadSnapshotOutput } from "../src/stages/load-snapshot";

describe("artifact manifest emission", () => {
  it("refuses to build a release artifact from a synthetic fixture snapshot", async () => {
    const root = mkdtempSync(join(tmpdir(), "ardenfall-artifact-manifest-"));
    try {
      const snapshot = fixtureSnapshot("synthetic-fixture");
      await expect(
        buildArtifactManifest({
          artifactKind: "release",
          artifactId: "bad-release",
          artifactDir: root,
          snapshot,
          sqliteOutput: { outputPath: join(root, "data.sqlite"), byteSize: 1 },
          assetsOutput: { assetsDir: join(root, "assets"), refs: [], itemIconMetadata: [] },
        }),
      ).rejects.toThrow(/release artifacts require live-game-export snapshots/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("emits release manifest identity, hashes, counts, and probes", async () => {
    const root = mkdtempSync(join(tmpdir(), "ardenfall-artifact-manifest-"));
    try {
      mkdirSync(join(root, "assets"), { recursive: true });
      writeFileSync(join(root, "assets", "a".repeat(64) + ".webp"), "asset bytes");
      const db = new Database(join(root, "data.sqlite"));
      db.exec(`
        CREATE TABLE item_overview_rows (id TEXT PRIMARY KEY, name TEXT, display_icon_hash TEXT);
        INSERT INTO item_overview_rows VALUES ('item-a', 'Item A', '${"a".repeat(64)}');
      `);
      db.close();

      const manifest = await buildArtifactManifest({
        artifactKind: "release",
        artifactId: "0.0.10.91-run-a",
        artifactDir: root,
        snapshot: fixtureSnapshot("live-game-export"),
        sqliteOutput: {
          outputPath: join(root, "data.sqlite"),
          byteSize: Bun.file(join(root, "data.sqlite")).size,
        },
        assetsOutput: {
          assetsDir: join(root, "assets"),
          refs: [
            {
              entityId: "item",
              entityRowId: "item-a",
              slot: "displayIcon",
              assetKind: "image",
              assetHash: "a".repeat(64),
              outputPath: join(root, "assets", "a".repeat(64) + ".webp"),
            },
          ],
          itemIconMetadata: [],
        },
      });

      expect(manifest.artifactKind).toBe("release");
      expect(manifest.source.kind).toBe("live-game-export");
      expect(manifest.counts.itemOverviewRows).toBe(1);
      expect(manifest.outputs.sqlite.bytes).toBeGreaterThan(0);
      expect(manifest.probes.items).toEqual([
        { id: "item-a", name: "Item A", displayIconHash: "a".repeat(64) },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

function fixtureSnapshot(kind: "live-game-export" | "synthetic-fixture"): LoadSnapshotOutput {
  return {
    manifest: {
      schemaVersion: 1,
      source: kind === "live-game-export" ? { kind } : { kind, fixtureName: "synthetic" },
      gameVersion: "0.0.10.91",
      buildIdentifier: "run-a",
      extractorVersion: "0.1.0",
      extractedAt: "2026-05-15T00:00:00.000Z",
      preflight: { passed: true, completedAt: "2026-05-15T00:00:00.000Z", checks: [] },
      counts: { item: 1 },
      diagnostics: { fatal: 0, diagnostic: 0 },
      hashes: { "items.json": "b".repeat(64) },
    },
    envelopes: {},
    diagnostics: [],
  };
}
```

- [ ] **Step 2: Run failing tests**

Run:

```sh
bun test pipeline/test/artifact-manifest.test.ts
```

Expected: FAIL because `pipeline/src/artifacts/manifest.ts` does not exist.

- [ ] **Step 3: Implement artifact manifest builder**

Create `pipeline/src/artifacts/manifest.ts`:

```ts
import { Database } from "bun:sqlite";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { sha256File, sha256Json, sha256Tree } from "./hash";
import type { ArtifactKind, ArtifactManifest } from "../types";
import type { EmitAssetsOutput } from "../stages/emit-assets";
import type { EmitSqliteOutput } from "../stages/emit-sqlite";
import type { LoadSnapshotOutput } from "../stages/load-snapshot";

export interface BuildArtifactManifestInput {
  artifactKind: ArtifactKind;
  artifactId: string;
  artifactDir: string;
  snapshot: LoadSnapshotOutput;
  sqliteOutput: EmitSqliteOutput;
  assetsOutput: EmitAssetsOutput;
}

export async function buildArtifactManifest(
  input: BuildArtifactManifestInput,
): Promise<ArtifactManifest> {
  const sourceKind = input.snapshot.manifest.source.kind;
  if (input.artifactKind === "release" && sourceKind !== "live-game-export") {
    throw new Error("release artifacts require live-game-export snapshots");
  }
  if (input.artifactKind === "fixture" && sourceKind !== "synthetic-fixture") {
    throw new Error("fixture artifacts require synthetic-fixture snapshots");
  }

  const sqlitePath = join(input.artifactDir, "data.sqlite");
  const assetsDir = join(input.artifactDir, "assets");
  const probes = readItemProbes(sqlitePath);
  const manifest: ArtifactManifest = {
    schemaVersion: 1,
    artifactKind: input.artifactKind,
    artifactId: input.artifactId,
    createdAt: new Date().toISOString(),
    source: {
      kind: sourceKind,
      fixtureName:
        input.snapshot.manifest.source.kind === "synthetic-fixture"
          ? input.snapshot.manifest.source.fixtureName
          : undefined,
      snapshotId: `${input.snapshot.manifest.gameVersion ?? "unknown"}-${input.snapshot.manifest.buildIdentifier ?? "unknown"}`,
      gameVersion: input.snapshot.manifest.gameVersion ?? "unknown",
      buildIdentifier: input.snapshot.manifest.buildIdentifier ?? "unknown",
      extractorVersion: input.snapshot.manifest.extractorVersion,
      snapshotManifestSha256: sha256Json(input.snapshot.manifest),
    },
    git: readGitIdentity(),
    diagnostics: input.snapshot.manifest.diagnostics,
    counts: {
      snapshotItems: input.snapshot.manifest.counts.item ?? 0,
      itemOverviewRows: countRows(sqlitePath, "item_overview_rows"),
      itemDetailRows: countRows(sqlitePath, "item_detail_rows"),
      assetRefs: input.assetsOutput.refs.length,
      webpAssets:
        input.assetsOutput.refs.length === 0
          ? 0
          : new Set(input.assetsOutput.refs.map((ref) => ref.assetHash)).size,
    },
    outputs: {
      sqlite: {
        path: "data.sqlite",
        bytes: input.sqliteOutput.byteSize,
        sha256: await sha256File(sqlitePath),
      },
      assets: {
        path: "assets",
        count: new Set(input.assetsOutput.refs.map((ref) => ref.assetHash)).size,
        treeSha256: await sha256Tree(assetsDir),
      },
    },
    probes: { items: probes },
  };
  writeFileSync(
    join(input.artifactDir, "artifact-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return manifest;
}

function readItemProbes(sqlitePath: string): ArtifactManifest["probes"]["items"] {
  const db = new Database(sqlitePath, { readonly: true });
  try {
    return db
      .query<{ id: string; name: string; displayIconHash: string | null }, []>(
        `SELECT id, name, display_icon_hash AS displayIconHash
         FROM item_overview_rows
         WHERE name IS NOT NULL
         ORDER BY display_icon_hash IS NULL, name
         LIMIT 3`,
      )
      .all();
  } finally {
    db.close();
  }
}

function countRows(sqlitePath: string, table: string): number {
  const db = new Database(sqlitePath, { readonly: true });
  try {
    const row = db.query<{ count: number }, []>(`SELECT COUNT(*) AS count FROM ${table}`).get();
    return row?.count ?? 0;
  } finally {
    db.close();
  }
}

function readGitIdentity(): ArtifactManifest["git"] {
  const commit = Bun.spawnSync(["git", "rev-parse", "HEAD"]).stdout.toString().trim();
  const branch =
    Bun.spawnSync(["git", "branch", "--show-current"]).stdout.toString().trim() || "detached";
  const status = Bun.spawnSync(["git", "status", "--porcelain"]).stdout.toString();
  const remote = Bun.spawnSync(["git", "config", "--get", "remote.origin.url"])
    .stdout.toString()
    .trim();
  return {
    repository: remote.replace(/^https:\/\/github.com\//, "").replace(/\.git$/, ""),
    commit,
    branch,
    dirty: status.length > 0,
  };
}
```

- [ ] **Step 4: Add SQLite artifact metadata table**

In `pipeline/src/stages/emit-sqlite.ts`, after read models are emitted but before closing the DB, add:

```ts
db.exec(`CREATE TABLE artifact_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
const metadataInsert = db.prepare("INSERT INTO artifact_metadata (key, value) VALUES (?, ?)");
metadataInsert.run("schemaVersion", "1");
```

This table is populated with final manifest values in Task 5 after manifest generation is available to the site verifier. Keep only `schemaVersion` in this task so the table exists without inventing final manifest hashes before the manifest is written.

- [ ] **Step 5: Run artifact tests**

Run:

```sh
bun test pipeline/test/artifact-manifest.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```sh
git add pipeline/src/artifacts/manifest.ts pipeline/src/stages/emit-sqlite.ts pipeline/test/artifact-manifest.test.ts
git commit -m "feat(pipeline): emit artifact manifests"
```

---

### Task 4: Split pipeline CLI into fixture and release artifact commands

**Files:**

- Modify: `pipeline/src/cli.ts`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Test: `tooling.test.ts`
- Test: `pipeline/test/cli-artifacts.test.ts`

- [ ] **Step 1: Write failing tooling tests for command separation**

Add to `tooling.test.ts`:

```ts
it("separates fixture artifact builds from release artifact builds", () => {
  expect(packageJson.scripts["artifact:fixture"]).toBe("bun run pipeline/src/cli.ts build-fixture");
  expect(packageJson.scripts["artifact:release"]).toBe("bun run pipeline/src/cli.ts build-release");
  expect(ciWorkflow).toContain("bun run artifact:fixture synthetic fixtures/synthetic/snapshot");
  expect(ciWorkflow).not.toContain("fixtures/synthetic/snapshot pipeline/dist");
});
```

- [ ] **Step 2: Run failing tooling test**

Run:

```sh
bun test tooling.test.ts -t "separates fixture artifact builds from release artifact builds"
```

Expected: FAIL because scripts and CI still use `pipeline:run`/`pipeline/dist`.

- [ ] **Step 3: Implement CLI command parsing**

Replace the top-level argument parsing in `pipeline/src/cli.ts` with this shape:

```ts
const [, , subcommand, firstArg, secondArg] = Bun.argv;

function usage(): never {
  console.error(`usage:
  ardenfall-pipeline build-fixture <fixtureName> <snapshotDir>
  ardenfall-pipeline build-release <snapshotDir>
  ardenfall-pipeline run <snapshotDir> <outDir>`);
  process.exit(2);
}

let snapshotDir: string;
let outDir: string;
let artifactKind: "fixture" | "release" | null = null;
let artifactId: string;

if (subcommand === "build-fixture" && firstArg && secondArg) {
  const fixtureName = firstArg;
  snapshotDir = secondArg;
  outDir = `pipeline/artifacts/fixtures/${fixtureName}`;
  artifactKind = "fixture";
  artifactId = fixtureName;
} else if (subcommand === "build-release" && firstArg && !secondArg) {
  snapshotDir = firstArg;
  const snapshotManifest = JSON.parse(await Bun.file(`${snapshotDir}/manifest.json`).text()) as {
    gameVersion?: string;
    buildIdentifier?: string;
  };
  if (!snapshotManifest.gameVersion || !snapshotManifest.buildIdentifier) {
    throw new Error("release snapshots require gameVersion and buildIdentifier");
  }
  artifactId = `${snapshotManifest.gameVersion}-${snapshotManifest.buildIdentifier}`;
  outDir = `pipeline/artifacts/releases/${artifactId}`;
  artifactKind = "release";
} else if (subcommand === "run" && firstArg && secondArg) {
  snapshotDir = firstArg;
  outDir = secondArg;
  artifactId = "debug-run";
} else {
  usage();
}
```

After the existing `const result = await runStages(stages, {}, ctx);` line, add:

```ts
if (artifactKind) {
  const manifest = await buildArtifactManifest({
    artifactKind,
    artifactId,
    artifactDir: outDir,
    snapshot: result["load-snapshot"] as LoadSnapshotOutput,
    sqliteOutput: result["emit-sqlite"] as EmitSqliteOutput,
    assetsOutput: result["emit-assets"] as EmitAssetsOutput,
  });
  console.warn(
    `wrote ${outDir}/artifact-manifest.json (${manifest.artifactKind} ${manifest.artifactId})`,
  );
}
```

Import the referenced types and builder:

```ts
import { buildArtifactManifest } from "./artifacts/manifest";
import type { EmitAssetsOutput } from "./stages/emit-assets";
import type { EmitSqliteOutput } from "./stages/emit-sqlite";
import type { LoadSnapshotOutput } from "./stages/load-snapshot";
```

- [ ] **Step 4: Update root scripts and CI**

In root `package.json`, add scripts:

```json
"artifact:fixture": "bun run pipeline/src/cli.ts build-fixture",
"artifact:release": "bun run pipeline/src/cli.ts build-release"
```

Keep `pipeline:run` for debugging only.

In `.github/workflows/ci.yml`, replace the synthetic build step with:

```yaml
- name: build synthetic fixture artifact for static prerender
  run: bun run artifact:fixture synthetic fixtures/synthetic/snapshot
```

- [ ] **Step 5: Run fixture artifact build**

Run:

```sh
rm -rf pipeline/artifacts/fixtures/synthetic
bun run artifact:fixture synthetic fixtures/synthetic/snapshot
```

Expected:

```text
wrote pipeline/artifacts/fixtures/synthetic/data.sqlite
wrote pipeline/artifacts/fixtures/synthetic/assets
wrote pipeline/artifacts/fixtures/synthetic/artifact-manifest.json (fixture synthetic)
```

- [ ] **Step 6: Verify release command rejects synthetic fixture**

Run:

```sh
bun run artifact:release fixtures/synthetic/snapshot
```

Expected: non-zero exit with `release artifacts require live-game-export snapshots`.

- [ ] **Step 7: Run tests**

Run:

```sh
bun test tooling.test.ts -t "separates fixture artifact builds from release artifact builds"
bun test pipeline/test/artifact-manifest.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```sh
git add pipeline/src/cli.ts package.json .github/workflows/ci.yml tooling.test.ts
git commit -m "feat(pipeline): split fixture and release artifacts"
```

---

### Task 5: Site artifact staging and validation

**Files:**

- Create: `site/scripts/stage-artifact.mjs`
- Replace: `site/scripts/assert-production-data.mjs`
- Modify: `site/scripts/sync-generated-artifacts.mjs`
- Modify: `site/package.json`
- Test: `tooling.test.ts`

- [ ] **Step 1: Write failing staging tests**

Add to `tooling.test.ts`:

```ts
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
          sqlite: { path: "data.sqlite", bytes: 36, sha256: "c".repeat(64) },
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
```

- [ ] **Step 2: Run failing tests**

Run:

```sh
bun test tooling.test.ts -t "stages site builds from explicit artifact directories|production staging rejects fixture artifacts"
```

Expected: FAIL because scripts and `stage-artifact.mjs` do not exist.

- [ ] **Step 3: Implement `stage-artifact.mjs`**

Create `site/scripts/stage-artifact.mjs`:

```js
import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

export async function stageArtifact({ artifactDir, targetDir, mode }) {
  const manifestPath = join(artifactDir, "artifact-manifest.json");
  if (!existsSync(manifestPath)) throw new Error(`missing artifact manifest: ${manifestPath}`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  if (mode === "release" && manifest.artifactKind !== "release") {
    throw new Error(`release staging requires artifactKind release, got ${manifest.artifactKind}`);
  }
  if (mode === "fixture" && manifest.artifactKind !== "fixture") {
    throw new Error(`fixture staging requires artifactKind fixture, got ${manifest.artifactKind}`);
  }
  if (mode === "release" && manifest.source?.kind !== "live-game-export") {
    throw new Error(
      `release staging requires live-game-export source, got ${manifest.source?.kind}`,
    );
  }
  if (manifest.diagnostics?.fatal !== 0) {
    throw new Error(`artifact has fatal diagnostics: ${manifest.diagnostics?.fatal}`);
  }

  const sqlitePath = join(artifactDir, "data.sqlite");
  const assetsDir = join(artifactDir, "assets");
  assertFileHash(sqlitePath, manifest.outputs.sqlite.sha256, manifest.outputs.sqlite.bytes);
  assertAssetTree(assetsDir, manifest.outputs.assets.treeSha256);
  assertSqliteCounts(sqlitePath, manifest.counts);

  mkdirSync(targetDir, { recursive: true });
  rmSync(join(targetDir, "data.sqlite"), { force: true });
  rmSync(join(targetDir, "_release.json"), { force: true });
  rmSync(join(targetDir, "assets"), { recursive: true, force: true });

  copyFileSync(sqlitePath, join(targetDir, "data.sqlite"));
  copyTree(assetsDir, join(targetDir, "assets"));
  writeFileSync(
    join(targetDir, "_release.json"),
    `${JSON.stringify(publicRelease(manifest), null, 2)}\n`,
  );
  return { manifest, targetDir };
}

function publicRelease(manifest) {
  return {
    schemaVersion: manifest.schemaVersion,
    artifactKind: manifest.artifactKind,
    artifactId: manifest.artifactId,
    source: manifest.source,
    git: manifest.git,
    diagnostics: manifest.diagnostics,
    counts: manifest.counts,
    outputs: manifest.outputs,
    probes: manifest.probes,
  };
}

function assertFileHash(path, expectedHash, expectedBytes) {
  const info = statSync(path);
  if (info.size !== expectedBytes) {
    throw new Error(
      `artifact file size mismatch for ${path}: expected ${expectedBytes}, got ${info.size}`,
    );
  }
  const actualHash = createHash("sha256").update(readFileSync(path)).digest("hex");
  if (actualHash !== expectedHash) {
    throw new Error(
      `artifact file hash mismatch for ${path}: expected ${expectedHash}, got ${actualHash}`,
    );
  }
}

function assertAssetTree(dir, expectedHash) {
  const entries = listFiles(dir).map((path) => {
    const relative = path.slice(dir.length + 1).replaceAll("\\\\", "/");
    const hash = createHash("sha256").update(readFileSync(path)).digest("hex");
    return `${relative}\0${hash}`;
  });
  const actualHash = createHash("sha256").update(entries.join("\n")).digest("hex");
  if (actualHash !== expectedHash) {
    throw new Error(`asset tree hash mismatch: expected ${expectedHash}, got ${actualHash}`);
  }
}

function assertSqliteCounts(path, counts) {
  const db = new Database(path, { readonly: true });
  try {
    const overview = db.query("SELECT COUNT(*) AS count FROM item_overview_rows").get().count;
    const detail = db.query("SELECT COUNT(*) AS count FROM item_detail_rows").get().count;
    if (counts.itemOverviewRows !== undefined && overview !== counts.itemOverviewRows) {
      throw new Error(
        `itemOverviewRows mismatch: expected ${counts.itemOverviewRows}, got ${overview}`,
      );
    }
    if (counts.itemDetailRows !== undefined && detail !== counts.itemDetailRows) {
      throw new Error(`itemDetailRows mismatch: expected ${counts.itemDetailRows}, got ${detail}`);
    }
  } finally {
    db.close();
  }
}

function copyTree(source, target) {
  mkdirSync(target, { recursive: true });
  for (const sourcePath of listFiles(source)) {
    const relative = sourcePath.slice(source.length + 1);
    const targetPath = join(target, relative);
    mkdirSync(dirname(targetPath), { recursive: true });
    copyFileSync(sourcePath, targetPath);
  }
}

function listFiles(dir) {
  const files = [];
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files.sort();
}

if (import.meta.main) {
  const artifactDir = Bun.argv[2] ? resolve(Bun.argv[2]) : null;
  const modeArg = Bun.argv.includes("--mode") ? Bun.argv[Bun.argv.indexOf("--mode") + 1] : null;
  if (!artifactDir || (modeArg !== "fixture" && modeArg !== "release")) {
    throw new Error("usage: stage-artifact <artifactDir> --mode <fixture|release>");
  }
  const result = await stageArtifact({
    artifactDir,
    targetDir: resolve(import.meta.dirname, "../static"),
    mode: modeArg,
  });
  process.stdout.write(
    `staged ${result.manifest.artifactKind} artifact ${result.manifest.artifactId}\n`,
  );
}
```

- [ ] **Step 4: Replace row-count guard with artifact staging**

Keep `site/scripts/assert-production-data.mjs` temporarily as a wrapper that tells operators the new command:

```js
throw new Error(
  "assert-production-data was replaced by stage-artifact release validation; use bun run --cwd site deploy:production <release-artifact-dir>",
);
```

This removes the row-count heuristic from production flow.

- [ ] **Step 5: Update site scripts**

In `site/package.json`, set:

```json
{
  "scripts": {
    "build": "bun run build:fixture",
    "build:prepared": "vite build",
    "build:fixture": "bun run stage:artifact ../pipeline/artifacts/fixtures/synthetic --mode fixture && bun run build:prepared",
    "stage:artifact": "bun run scripts/stage-artifact.mjs",
    "deploy:production": "bun run scripts/deploy-production.mjs",
    "cf-deploy": "bun run deploy:production"
  }
}
```

Keep existing `check`, `smoke:item-icons`, and `smoke:prerender` scripts unchanged.

- [ ] **Step 6: Run tests**

Run:

```sh
bun test tooling.test.ts -t "stages site builds from explicit artifact directories|production staging rejects fixture artifacts"
```

Expected: PASS.

- [ ] **Step 7: Commit**

```sh
git add site/scripts/stage-artifact.mjs site/scripts/assert-production-data.mjs site/scripts/sync-generated-artifacts.mjs site/package.json tooling.test.ts
git commit -m "feat(site): stage explicit generated artifacts"
```

---

### Task 6: Build and deploy release smoke checks

**Files:**

- Modify: `site/scripts/smoke-prerender-output.mjs`
- Create: `site/scripts/deploy-production.mjs`
- Create: `site/scripts/smoke-production-release.mjs`
- Test: `tooling.test.ts`

- [ ] **Step 1: Write failing tooling tests for release-aware smokes**

Add to `tooling.test.ts`:

```ts
it("uses release metadata for local and production smokes", () => {
  const localSmoke = readFileSync("site/scripts/smoke-prerender-output.mjs", "utf8");
  expect(localSmoke).toContain("_release.json");
  expect(localSmoke).toContain("manifest.probes.items");

  expect(existsSync("site/scripts/smoke-production-release.mjs")).toBe(true);
  const remoteSmoke = readFileSync("site/scripts/smoke-production-release.mjs", "utf8");
  expect(remoteSmoke).toContain("/_release.json");
  expect(remoteSmoke).toContain("data.sqlite");
  expect(remoteSmoke).toContain("manifest.outputs.sqlite.sha256");

  const deploy = readFileSync("site/scripts/deploy-production.mjs", "utf8");
  expect(deploy).toContain("stageArtifact");
  expect(deploy).toContain("wrangler deploy");
  expect(deploy).toContain("smoke-production-release.mjs");
});
```

- [ ] **Step 2: Run failing test**

Run:

```sh
bun test tooling.test.ts -t "uses release metadata for local and production smokes"
```

Expected: FAIL because production smoke/deploy scripts do not exist and local smoke does not use `_release.json`.

- [ ] **Step 3: Update local prerender smoke**

Modify `site/scripts/smoke-prerender-output.mjs` to read `site/static/_release.json` and use release probes:

```js
const releasePath = join(import.meta.dirname, "..", "static", "_release.json");
if (!existsSync(releasePath)) throw new Error(`missing staged release metadata: ${releasePath}`);
const manifest = JSON.parse(readFileSync(releasePath, "utf8"));
const probe = manifest.probes.items[0];
if (!probe) throw new Error("release metadata contains no item probes");
```

Use `probe.name`, `probe.id`, and `probe.displayIconHash` for overview/detail/asset checks. Keep the forbidden checks for `_app/immutable/entry/app`, `data.sqlite`, and `sqlite-wasm`.

- [ ] **Step 4: Create production smoke script**

Create `site/scripts/smoke-production-release.mjs`:

```js
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const [artifactManifestPath, origin = "https://ardenfall.compendiums.org"] = Bun.argv.slice(2);
if (!artifactManifestPath) {
  throw new Error("usage: smoke-production-release <artifact-manifest.json> [origin]");
}

const manifest = JSON.parse(readFileSync(artifactManifestPath, "utf8"));
const releaseRes = await fetch(`${origin}/_release.json`, {
  headers: { "cache-control": "no-cache" },
});
if (!releaseRes.ok) throw new Error(`/_release.json returned ${releaseRes.status}`);
const deployed = await releaseRes.json();
if (deployed.artifactId !== manifest.artifactId) {
  throw new Error(
    `deployed artifact mismatch: expected ${manifest.artifactId}, got ${deployed.artifactId}`,
  );
}
if (deployed.git.commit !== manifest.git.commit) {
  throw new Error(
    `deployed git commit mismatch: expected ${manifest.git.commit}, got ${deployed.git.commit}`,
  );
}

const sqliteRes = await fetch(`${origin}/data.sqlite`, {
  headers: { "cache-control": "no-cache" },
});
if (!sqliteRes.ok) throw new Error(`/data.sqlite returned ${sqliteRes.status}`);
const sqliteBytes = new Uint8Array(await sqliteRes.arrayBuffer());
const sqliteHash = createHash("sha256").update(sqliteBytes).digest("hex");
if (sqliteHash !== manifest.outputs.sqlite.sha256) {
  throw new Error(
    `deployed sqlite hash mismatch: expected ${manifest.outputs.sqlite.sha256}, got ${sqliteHash}`,
  );
}

const probe = manifest.probes.items[0];
const overview = await fetchText(`${origin}/items`);
if (!overview.includes(probe.name) || !overview.includes("/assets/")) {
  throw new Error("production overview HTML does not contain release probe content");
}
if (overview.includes("_app/immutable/entry/app") || overview.includes("sqlite-wasm")) {
  throw new Error("production overview HTML should not be hydrated SQLite SPA output");
}

const detail = await fetchText(`${origin}/items/${probe.id}`);
if (!detail.includes(probe.name) || !detail.includes("item-icon")) {
  throw new Error("production detail HTML does not contain release probe content");
}
if (detail.includes("_app/immutable/entry/app") || detail.includes("sqlite-wasm")) {
  throw new Error("production detail HTML should not be hydrated SQLite SPA output");
}

if (probe.displayIconHash) {
  const assetRes = await fetch(`${origin}/assets/${probe.displayIconHash}.webp`, {
    headers: { "cache-control": "no-cache" },
  });
  if (!assetRes.ok) throw new Error(`probe asset returned ${assetRes.status}`);
  const contentType = assetRes.headers.get("content-type") ?? "";
  if (!contentType.includes("image/webp"))
    throw new Error(`probe asset content-type mismatch: ${contentType}`);
}

process.stdout.write(`production smoke passed for ${manifest.artifactId}\n`);

async function fetchText(url) {
  const res = await fetch(url, { headers: { "cache-control": "no-cache" } });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return await res.text();
}
```

- [ ] **Step 5: Create production deploy script**

Create `site/scripts/deploy-production.mjs`:

```js
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { stageArtifact } from "./stage-artifact.mjs";

const artifactArg = Bun.argv[2];
if (!artifactArg) {
  throw new Error("usage: bun run --cwd site deploy:production <release-artifact-dir>");
}

const artifactDir = resolve(process.cwd(), artifactArg);
const manifestPath = join(artifactDir, "artifact-manifest.json");
await stageArtifact({
  artifactDir,
  targetDir: resolve(import.meta.dirname, "../static"),
  mode: "release",
});
run("bun", ["run", "build:prepared"]);
run("bun", ["run", "smoke:prerender"]);
run("wrangler", ["deploy"]);
run("bun", ["run", "scripts/smoke-production-release.mjs", manifestPath]);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: resolve(import.meta.dirname, ".."),
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit ${result.status}`);
  }
}
```

- [ ] **Step 6: Run tests**

Run:

```sh
bun test tooling.test.ts -t "uses release metadata for local and production smokes"
```

Expected: PASS.

- [ ] **Step 7: Commit**

```sh
git add site/scripts/smoke-prerender-output.mjs site/scripts/deploy-production.mjs site/scripts/smoke-production-release.mjs tooling.test.ts
git commit -m "feat(site): smoke deployed release identity"
```

---

### Task 7: Documentation and roadmap cleanup

**Files:**

- Modify: `AGENTS.md`
- Modify: `site/AGENTS.md`
- Modify: `README.md`
- Modify: `docs/superpowers/roadmap.md`
- Test: `tooling.test.ts`

- [ ] **Step 1: Write failing documentation guard test**

Add to `tooling.test.ts`:

```ts
it("documents release artifact provenance as the deploy contract", () => {
  const rootAgents = readFileSync("AGENTS.md", "utf8");
  const siteAgents = readFileSync("site/AGENTS.md", "utf8");
  const readme = readFileSync("README.md", "utf8");

  for (const text of [rootAgents, siteAgents, readme]) {
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
```

- [ ] **Step 2: Run failing doc test**

Run:

```sh
bun test tooling.test.ts -t "documents release artifact provenance as the deploy contract"
```

Expected: FAIL until docs are updated.

- [ ] **Step 3: Update root AGENTS**

Add to `AGENTS.md` non-negotiable invariants:

```md
- Generated deploy artifacts are identified by `artifact-manifest.json`. Production deploys consume only release artifacts under `pipeline/artifacts/releases/*`; fixture artifacts under `pipeline/artifacts/fixtures/*` are never deployable.
- `site/static` is a staging cache populated from a validated artifact. Do not treat it as source-of-truth and do not manually edit generated files there.
```

- [ ] **Step 4: Update site AGENTS**

Replace deployment bullets in `site/AGENTS.md` with:

```md
- Production deploys use `bun run --cwd site deploy:production ../pipeline/artifacts/releases/<snapshot-id>`. The command validates `artifact-manifest.json`, stages generated files into `site/static`, builds, smokes, deploys, and runs production release smoke.
- `site/static` is a staging cache. Its generated files must come from exactly one validated artifact and can be deleted/recreated at any time.
- Fixture builds use `bun run --cwd site build:fixture` after `bun run artifact:fixture synthetic fixtures/synthetic/snapshot`; fixture artifacts are valid for tests but must never be accepted by production deploy scripts.
```

- [ ] **Step 5: Update README commands**

Replace the site prerender smoke block with:

````md
Fixture site prerender smoke:

```sh
bun run artifact:fixture synthetic fixtures/synthetic/snapshot
bun run --cwd site build:fixture
bun run --cwd site smoke:prerender
```
````

Production release deploy:

```sh
bun run artifact:release snapshots/snapshots/<snapshot-id>
bun run --cwd site deploy:production ../pipeline/artifacts/releases/<snapshot-id>
```

Production deploys require a release artifact with `artifact-manifest.json`. `site/static` is a staging cache populated from the artifact; it is not source-of-truth.

````

- [ ] **Step 6: Update roadmap**

Add a new planned foundation slice before Slice 4:

```md
### Slice 3.6 — Artifact provenance release contract

**Status:** planned
**Spec:** `docs/superpowers/specs/2026-05-15-artifact-provenance-release-design.md`
**Plan:** `docs/superpowers/plans/2026-05-15-artifact-provenance-release.md`

**Why this interrupts the roadmap:** Slice 3.5 proved static prerendering works, but the first production deploy exposed that fixture and release artifacts shared `pipeline/dist`. Production deploys need provenance and artifact identity before further content slices add more generated pages.

**Acceptance criteria:** fixture builds emit fixture artifacts and remain fast; release builds emit release artifacts with Git/source/hash/count/probe metadata; production deploy scripts reject fixture artifacts; `/_release.json`, `/data.sqlite`, `/items`, an item detail route, and a representative asset are smoked against the same release manifest after deploy.
````

- [ ] **Step 7: Run doc test**

Run:

```sh
bun test tooling.test.ts -t "documents release artifact provenance as the deploy contract"
```

Expected: PASS.

- [ ] **Step 8: Commit**

```sh
git add AGENTS.md site/AGENTS.md README.md docs/superpowers/roadmap.md tooling.test.ts
git commit -m "docs(site): document release artifact contract"
```

---

### Task 8: Full verification and deployment rehearsal

**Files:**

- No new files expected.
- Verify all files changed by Tasks 1–7.

- [ ] **Step 1: Run fixture artifact and site verification**

Run:

```sh
rm -rf pipeline/artifacts/fixtures/synthetic site/.svelte-kit/cloudflare
bun run artifact:fixture synthetic fixtures/synthetic/snapshot
bun run --cwd site check
bun run --cwd site build:fixture
bun run --cwd site smoke:prerender
```

Expected: fixture artifact exists under `pipeline/artifacts/fixtures/synthetic`; site build succeeds; smoke uses `_release.json` and fixture probe content.

- [ ] **Step 2: Verify production deploy rejects fixture artifact**

Run:

```sh
bun run --cwd site deploy:production ../pipeline/artifacts/fixtures/synthetic
```

Expected: non-zero exit with `release staging requires artifactKind release`.

- [ ] **Step 3: Build real release artifact**

Run with the latest real snapshot path:

```sh
rm -rf pipeline/artifacts/releases/0.0.10.91-20260515-1414238114030
bun run artifact:release snapshots/snapshots/0.0.10.91-20260515-1414238114030
```

Expected: release artifact exists under `pipeline/artifacts/releases/0.0.10.91-20260515-1414238114030` with `artifact-manifest.json`, `data.sqlite`, and `assets/`.

- [ ] **Step 4: Build release locally without deploying**

Run:

```sh
bun run --cwd site stage:artifact ../pipeline/artifacts/releases/0.0.10.91-20260515-1414238114030 --mode release
bun run --cwd site build:prepared
bun run --cwd site smoke:prerender
```

Expected: local build passes and smoke checks release probe content from `_release.json`.

- [ ] **Step 5: Run repository gates**

Run:

```sh
bun run codegen:validators
bun run typecheck
bun test tooling.test.ts
bun test pipeline/test
bun test controller/test
dotnet test mod-tests/ArdenfallCompendium.Tests.csproj
bun run --cwd site check
bun run --cwd site build:fixture
bun run --cwd site smoke:prerender
bun run format:check
bun run lint
git diff --check
```

Expected: all commands exit 0 except existing lint warnings only if the current baseline already contains those warnings and ESLint exits 0.

- [ ] **Step 6: Commit verification-only doc updates if any**

If verification changes generated validators or docs, commit them:

```sh
git add pipeline/dist docs/superpowers/roadmap.md README.md AGENTS.md site/AGENTS.md
git commit -m "chore(pipeline): refresh artifact provenance validators"
```

If there are no changes, do not create an empty commit.

- [ ] **Step 7: Production deploy only after explicit approval**

Do not deploy unless the user asks after reviewing the implementation. If asked, run:

```sh
git push origin main
bun run --cwd site deploy:production ../pipeline/artifacts/releases/0.0.10.91-20260515-1414238114030
```

Expected: deploy script prints the Wrangler deployment result and `production smoke passed for 0.0.10.91-20260515-1414238114030`.

---

## Self-review checklist

- Spec coverage: Tasks 1–2 implement provenance schema and hash identity; Tasks 3–4 implement artifact channels; Task 5 implements explicit staging; Task 6 implements local/remote identity smokes; Task 7 documents the contract; Task 8 verifies and rehearses deploy rejection.
- Fixture benefit preserved: Task 4 and Task 8 keep `artifact:fixture` and `build:fixture` as fast local/CI paths.
- Production safety improved: production deploy requires a release artifact path, validates manifest kind/source/hashes/counts, and rejects fixture artifacts before SvelteKit build.
- Row-count hack removal: Task 5 removes the row-count deploy gate from the production flow and replaces it with manifest validation.
- Git commit tracking: Task 3 records repository, commit, branch, and dirty flag in artifact manifests; Task 6 verifies deployed `/_release.json` commit matches the release artifact.
