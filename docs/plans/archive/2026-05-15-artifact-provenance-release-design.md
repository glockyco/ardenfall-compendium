---
title: "Artifact Provenance Release Design"
type: spec
status: implemented
created: 2026-05-15
parent:
superseded_by:
archived: 2026-06-25
---

# Artifact Provenance Release Design

**Date:** 2026-05-15  
**Status:** Approved design direction; written for implementation planning  
**Game version context:** Ardenfall Demo `0.0.10.91`  
**Incident:** A production deploy used synthetic fixture output from `pipeline/dist`, reducing the live item set from 1,273 rows to 5 rows.

## Purpose

Production deploys must be correct by default. The build pipeline should preserve fast synthetic fixture tests, but fixture output must be structurally unable to reach Cloudflare production.

This design replaces the ambiguous mutable `pipeline/dist` deploy source with typed, provenance-bearing artifact channels:

1. fixture artifacts for quick tests and deterministic edge cases;
2. release artifacts for production deployment;
3. explicit staging from one validated artifact into `site/static`;
4. public release metadata that lets us answer what production is serving.

The immediate row-count guard remains useful as temporary defense-in-depth, but it is not the long-term trust boundary. The long-term boundary is artifact identity: provenance, hashes, source kind, exact counts, release probes, and post-deploy verification against the same manifest.

## Source-grounded principles

SLSA defines provenance as verifiable information about where, when, and how an artifact was produced, and recommends publishing immutable attestations bound to artifacts. GitHub artifact attestations similarly include repository, environment, commit SHA, workflow, and triggering event, and warn that attestations are useful only when verified. Cloudflare Workers Static Assets serves matching static files before Worker invocation by default, so the deployable static bundle should be treated as an artifact whose identity is verified before and after upload. SvelteKit prerendered dynamic routes should be generated from explicit `entries()` data and are only trustworthy if that build-time data artifact is the intended one.

References:

- SLSA provenance distribution: https://slsa.dev/spec/v1.0/distributing-provenance
- GitHub artifact attestations: https://docs.github.com/en/actions/concepts/security/artifact-attestations
- Cloudflare Static Assets routing: https://developers.cloudflare.com/workers/static-assets/routing/worker-script/
- SvelteKit page options and `entries()`: https://svelte.dev/docs/kit/page-options

## Current failure mode

The repository currently allows this sequence:

```sh
bun run pipeline:run fixtures/synthetic/snapshot pipeline/dist
bun run --cwd site cf-deploy
```

`cf-deploy` syncs whatever is in `pipeline/dist` into `site/static`, builds, and deploys. A fixture build and a production build therefore produce the same shape in the same location. The smoke test can then prove that the deployed fixture artifact is internally consistent, while failing to prove that the deployed artifact is a real release.

This is a human-factors bug and an architecture bug. The system asked the operator to remember which command last wrote a mutable directory. Production correctness cannot depend on that memory.

## Artifact channels

The pipeline emits artifacts under separate roots:

```text
pipeline/artifacts/
  fixtures/
    synthetic/
      artifact-manifest.json
      data.sqlite
      assets/*.webp
  releases/
    0.0.10.91-20260515-1414238114030/
      artifact-manifest.json
      data.sqlite
      assets/*.webp
```

Rules:

- `pipeline/artifacts/fixtures/*` is valid for local and CI fixture builds only.
- `pipeline/artifacts/releases/*` is the only valid source for production deployment.
- `site/static` is a generated staging cache, never source-of-truth.
- `pipeline/dist` is not a deploy contract. It may remain temporarily as a compatibility/debug output, but deploy scripts must not read it.
- Release artifact directories are immutable by convention: a changed input creates a new artifact directory or fails hash verification.

## Snapshot provenance

Snapshot manifests record their source class:

```json
{
  "source": {
    "kind": "live-game-export"
  }
}
```

Synthetic fixtures record:

```json
{
  "source": {
    "kind": "synthetic-fixture",
    "fixtureName": "synthetic"
  }
}
```

The pipeline copies this source provenance into the artifact manifest. Release artifact generation refuses snapshots whose source kind is not `live-game-export`. Fixture artifact generation refuses snapshots whose source kind is not `synthetic-fixture`.

For the migration, existing generated snapshots without `source` are not silently treated as production. Operators must regenerate from the controller or explicitly stamp a local historical snapshot with reviewed provenance in a separate maintenance action. The default path fails closed.

## Artifact manifest contract

Every emitted artifact contains `artifact-manifest.json` beside `data.sqlite` and `assets/`.

Required fields:

```json
{
  "schemaVersion": 1,
  "artifactKind": "release",
  "artifactId": "0.0.10.91-20260515-1414238114030",
  "createdAt": "2026-05-15T14:20:00.000Z",
  "source": {
    "kind": "live-game-export",
    "snapshotId": "0.0.10.91-20260515-1414238114030",
    "gameVersion": "0.0.10.91",
    "buildIdentifier": "20260515-1414238114030",
    "extractorVersion": "0.1.0",
    "snapshotManifestSha256": "64 lowercase hex characters"
  },
  "git": {
    "repository": "glockyco/ardenfall-compendium",
    "commit": "full 40 character commit sha",
    "branch": "main",
    "dirty": false
  },
  "toolchain": {
    "bun": "1.3.14",
    "svelteKit": "2.59.1",
    "wrangler": "4.90.1"
  },
  "diagnostics": {
    "fatal": 0,
    "diagnostic": 3041
  },
  "counts": {
    "snapshotItems": 1273,
    "itemOverviewRows": 1273,
    "itemDetailRows": 1273,
    "assetRefs": 1745,
    "webpAssets": 87
  },
  "outputs": {
    "sqlite": {
      "path": "data.sqlite",
      "bytes": 5402624,
      "sha256": "64 lowercase hex characters"
    },
    "assets": {
      "path": "assets",
      "count": 87,
      "treeSha256": "64 lowercase hex characters"
    }
  },
  "probes": {
    "items": [
      {
        "id": "055b284f8d0701643bc93d0879ebf85e.11400000",
        "name": "A Treatise On The Nature of The Darvaki I",
        "displayIconHash": "1f004d6a9f4e47565f6fc037205f0815a1a7b1651fed6027bf86e68d232f0e80"
      }
    ]
  }
}
```

Fixture manifests use the same shape with `artifactKind: "fixture"` and `source.kind: "synthetic-fixture"`. They may have small counts. They are valid artifacts, but not deployable artifacts.

## SQLite metadata table

The pipeline also writes an `artifact_metadata` table into `data.sqlite`:

```sql
CREATE TABLE artifact_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

Minimum keys:

- `artifactKind`
- `artifactId`
- `sourceKind`
- `sourceSnapshotId`
- `gitCommit`
- `manifestSha256`

This redundancy catches partial-copy failures where a DB and sidecar manifest come from different builds.

## Site staging and release metadata

The site build consumes an explicit artifact directory. Staging performs these steps:

1. validate `artifact-manifest.json` against schema;
2. validate artifact kind for the requested mode;
3. verify `data.sqlite` bytes and SHA-256;
4. verify asset tree hash and referenced asset existence;
5. verify SQLite metadata matches the sidecar manifest;
6. delete generated files from `site/static`;
7. copy only manifest-declared files;
8. write public `site/static/_release.json`.

`/_release.json` is safe to publish and excludes local machine paths, usernames, hostnames, and secrets. It includes release id, source snapshot id, game version, Git commit, artifact hashes, counts, and release probes.

Production smoke reads `/_release.json` from the deployed site and compares it to the local release artifact manifest used for deployment.

## Command design

The command vocabulary separates intent:

```sh
bun run artifact:fixture synthetic
bun run artifact:release snapshots/snapshots/0.0.10.91-20260515-1414238114030
bun run --cwd site build:fixture synthetic
bun run --cwd site build:release ../pipeline/artifacts/releases/0.0.10.91-20260515-1414238114030
bun run --cwd site deploy:production ../pipeline/artifacts/releases/0.0.10.91-20260515-1414238114030
```

`deploy:production` has no default artifact path. It fails if the argument is missing or if the artifact is not a validated release artifact.

`cf-deploy` may remain as a compatibility alias only if it delegates to `deploy:production` and requires the same explicit release artifact argument.

## CI design

CI keeps fast fixture coverage:

1. `fixture-artifact` builds `pipeline/artifacts/fixtures/synthetic`.
2. `fixture-site` stages that fixture artifact and runs SvelteKit check/build/prerender smoke.
3. Tests verify deploy scripts reject fixture artifacts.

Production deploy should be a protected/manual release flow, not a side effect of fixture CI. When production artifacts are built in CI, the deploy job consumes only an uploaded artifact whose name encodes kind and commit, such as `release-artifact-${github.sha}`.

## Verification policy

Pre-build checks:

- artifact kind and source kind match requested mode;
- manifest schema valid;
- Git dirty flag is false for release artifacts;
- fatal diagnostics are zero;
- file hashes match manifest;
- SQLite counts match manifest counts;
- SQLite metadata matches manifest identity;
- all referenced WebP assets exist.

Local post-build checks:

- `.svelte-kit/cloudflare/_release.json` exists and matches staged release metadata;
- `.svelte-kit/cloudflare/data.sqlite` hash matches manifest;
- `/items` and release probe detail pages are prerendered static HTML;
- item HTML contains release probe content and does not contain the Svelte hydration entry or `sqlite-wasm`;
- representative assets exist.

Remote post-deploy checks:

- production `/_release.json` matches the release artifact used for deploy;
- production `/data.sqlite` hash and SQLite header match manifest;
- production `/items` and probe detail routes return 200 and contain probe content;
- production representative assets return 200 with WebP content type;
- Cloudflare version id is recorded in the roadmap or release log.

## Options considered

### Option A — keep row-count guard

This is cheap and catches the exact recent fixture deploy, but it encodes today’s dataset size rather than artifact identity. It remains a temporary brake only.

### Option B — explicit artifact channels with provenance

This is the recommended path. It adds schema and script surface, but it eliminates the shared mutable path and lets deploys fail for the actual class of error: wrong artifact origin, mismatched files, stale staging, or wrong source commit.

### Option C — CI-only signed attestations first

GitHub/Sigstore attestations are valuable, but they do not replace the local artifact contract. We should first create the manifest and verification policy, then optionally add GitHub artifact attestations for release artifacts once production deploys move into CI.

## Non-goals

- This design does not introduce full SLSA compliance.
- This design does not require signing artifacts before the local deploy path is safe.
- This design does not remove synthetic fixtures.
- This design does not redesign SvelteKit routing beyond release identity checks and `/_release.json`.
- This design does not publish private local paths or operator identity.

## Acceptance criteria

- Synthetic fixture builds still run quickly in CI and locally.
- Fixture artifacts are impossible to deploy through production deploy scripts.
- Production deploy requires an explicit release artifact path.
- Release artifacts prove source kind, source snapshot, Git commit, file hashes, exact counts, and release probes.
- `site/static` is a staging cache and is cleaned before staging generated files.
- Local and production smokes compare the served site to the same release manifest.
- The current row-count guard is removed or reduced to diagnostic defense-in-depth after manifest validation is in place.
