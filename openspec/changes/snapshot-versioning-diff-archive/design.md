## Context

Release manifests already record the game version, build identifier, source snapshot, family counts, and output hashes. The pipeline also records a snapshot manifest hash and Git identity.

The controller already compares two exports from one session. It checks family counts, filtered runtime-created rows, and artifact hashes. Slice 13 extends those existing facts to releases from different builds.

A release comparison needs stable row identity and canonical row content. The canonical SQLite artifact provides both without making the site or the raw snapshot a second source of truth.

## Goals

- Give every release one committed digest that reviewers can inspect and machines can validate.
- Compare canonical rows across two archived releases.
- Preserve the raw snapshot and canonical SQLite artifact as one retrievable release record.
- Show extraction changes in pull request review.
- Keep archive storage independent from comparison and validation logic.

## Non-Goals

- Comparing generated HTML, CSS, or image pixels.
- Inferring changes from display labels or row order.
- Replacing the existing release manifest or same-session reproducibility check.
- Selecting an archive provider in this change.

## Decisions

### 1. The release digest is derived from the release manifest

The digest is a stable, committed summary of the release manifest. It repeats the source build identity and family counts because reviewers need those facts without opening the full manifest. It includes the release id, source snapshot id, extractor version, and output hashes.

The manifest remains the source of truth. The digest does not introduce a second count calculation. A validator checks that every digest field agrees with the manifest before publication.

### 2. Comparison uses stable identity and canonical content

The comparison reads each release manifest and canonical SQLite artifact. It groups rows by their declared family and stable identity. It compares a deterministic representation of each row after excluding operational metadata that is not content.

A row in only the newer release is appeared. A row in only the older release is disappeared. A row in both releases with different canonical content is changed. A row with equal canonical content is unchanged.

The comparison does not use display labels, generated routes, database row order, or asset timestamps as identity. It reports source builds and release ids with the row-state lists.

### 3. The command line is the review entry point

One command accepts two archive references and writes a human-readable summary. It also supports a machine-readable output for pull request automation. It validates both manifests before it reads comparison data, and it fails when either archive is missing or incomplete.

CI calls the same command that an operator uses. The pull request step stores the digest and comparison as a generated review section rather than maintaining a second formatter.

### 4. Archive contents are a complete comparison record

An archive record contains the release manifest, release digest, raw snapshot, and canonical SQLite artifact. Retrieval restores these files into a temporary release directory that existing validators and the comparison command can read.

The archive may retain assets when the deployment workflow needs them. Assets are not required for row comparison, so they do not define comparison completeness.

### 5. Archive backend remains open

The backend is deliberately not selected in this change. The archive interface MUST support storing, listing, retrieving, and verifying a release record by release id and digest.

The repository is one alternative. It gives simple review, local access, and no provider credentials. It grows clone size, makes retention expensive in Git history, and couples release storage to repository availability.

Release artifacts are a second alternative. They keep the source repository small and fit the current release directory layout. They depend on the release host, its retention policy, and permissions, so old comparisons can fail when artifacts expire.

An external object store is a third alternative. It supports large archives, lifecycle policies, and independent retention. It adds credentials, network failure modes, provider cost, and another service whose availability affects reproducibility.

The implementation MUST keep the backend choice in configuration. It MUST NOT make the comparison format depend on one provider.

## Risks and Trade-offs

- **Canonical row comparison can expose many changes.** Stable identity and family grouping make the output reviewable, while the digest provides a compact summary.
- **A digest can drift from its manifest.** Publication validates both, and the manifest remains authoritative.
- **Raw snapshots are large.** The archive contract keeps them available for diagnosis while allowing a later backend to apply compression and lifecycle rules.
- **Pull request automation can lose its comment.** The generated section has a stable marker, so CI can replace it on reruns rather than append duplicates.
- **Archive retention can remain unresolved.** The open backend decision is explicit, and retrieval tests use the backend contract rather than a provider-specific path.
