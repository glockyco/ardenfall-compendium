## Why

Each release already emits digests for its snapshot manifest, SQLite artifact, and static asset tree. The release manifest `pipeline/artifacts/releases/0.0.10.91-20260816-0100458904850/artifact-manifest.json` proves those digests exist, but no workflow compares releases or preserves raw inputs together.

## What Changes

- Commit a summary digest for every release.
- Add a CLI that compares two releases across versions.
- Archive the raw snapshot and its canonical SQLite artifact together.
- Publish a digest in each pull request body.
- Define archive retrieval and retention for repeatable comparisons.

The archive backend decision remains open. Keep archives in the repository, publish them as release artifacts, or store them in external object storage.

## Capabilities

### New Capabilities

- `snapshot-versioning-diff-archive`: release digests, cross-version comparisons, raw snapshot archives, and pull-request digest publication.
