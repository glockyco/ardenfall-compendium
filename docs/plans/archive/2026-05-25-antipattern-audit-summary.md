---
title: "Antipattern Audit Summary — 2026-05-25"
type: audit
status: implemented
created: 2026-05-25
parent:
superseded_by:
archived: 2026-06-25
---

# Antipattern Audit Summary — 2026-05-25

Source reports:

- [`best-practices-research.md`](./best-practices-research.md)
- [`code-antipattern-audit.md`](./code-antipattern-audit.md)
- [`export-pause-audit.md`](./export-pause-audit.md)

## External guidance applied

- AWS Builders Library warns that fallbacks are hard to test, often fail in
  the moment they are needed, can amplify outages, and should be replaced by
  stronger primary paths or continuously exercised failover when possible:
  <https://aws.amazon.com/builders-library/avoiding-fallback-in-distributed-systems/>.
- AWS timeout/retry guidance says timeouts must be explicit and observable,
  while retries must be bounded and owned at one layer to avoid load
  amplification:
  <https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/>.
- Google SRE monitoring guidance separates symptoms from causes and calls out
  failures hidden by retry or internal behavior as observability risks:
  <https://sre.google/sre-book/monitoring-distributed-systems/>.
- OpenTelemetry frames observability as the ability to ask new questions from
  existing telemetry, not as ad hoc logging added after incidents:
  <https://opentelemetry.io/docs/concepts/observability-primer/>.
- Google software engineering guidance treats tests as executable
  documentation and warns that brittle/flaky tests erode trust:
  <https://abseil.io/resources/swe-book/html/ch11.html>.
- AGENTS.md guidance recommends concise, repo-specific setup, test,
  convention, and boundary instructions, with nested files for local rules:
  <https://agents.md/> and
  <https://developers.openai.com/codex/guides/agents-md>.

## Highest-priority findings

1. **Tag IDs still have name-derived fallback behavior.**
   `ExtractItem` can use `tag.name` when `BuiltLookupTable.GetGuid(tag)` is
   absent, while `ItemTagExtractor` currently materializes a missing-GUID tag
   row with `assetName`. This is the same class of source-of-truth masking that
   was removed from stat/category extraction.

2. **Snapshot artifact contracts are duplicated across layers.**
   Mod finalize, controller validation, and pipeline descriptor loading each
   know overlapping entity/file/count contracts. This risks stale validation
   when adding entities and weakens the “filesystem is the registry” invariant.

3. **Batch chunk writes are not atomic.**
   `EntityExportBatchCommand` writes chunk JSON directly before marking the
   chunk complete. Final publish is atomic, but intermediate chunk durability
   can still produce late failures or partial files after process interruption.

4. **Production-safe artifact staging has a legacy bypass.**
   `site/scripts/stage-artifact.mjs` is manifest-backed and release-safe, but
   `site/scripts/sync-generated-artifacts.mjs` can still copy raw `pipeline/dist`
   outputs into `site/static` using only non-empty checks.

5. **Generated validator freshness is not enforced as a committed diff.**
   CI runs validator codegen before checks, but the audit did not find a
   `git diff --exit-code` style freshness gate. Clean checkouts can therefore
   carry stale committed validators after schema edits.

6. **Some public relationship/read-model paths still join by display names.**
   Item/category association in pipeline and site code falls back from
   `categoryRef.guid` to `categoryName`, making display names a second
   relationship source of truth.

7. **Slug generation has a silent hash fallback.**
   `deriveEntityNodeSlug` catches slug/short-id derivation failures and emits a
   hash-based route without recording a pipeline diagnostic.

8. **Static site item overview has N+1 read-model hydration.**
   `listItemsOverview()` maps rows through `getItemPresentation(row.id)`, and
   variant filtering hydrates all items before filtering. This is hidden by
   prerendering today but will grow build cost.

9. **Export flow had a real observability gap after final batch.**
   The blank pause is not idle time. It covers synchronous `run.finalize` plus
   controller `validateSnapshot`, and finalize performs chunk merge, non-item
   extraction, sprite asset export, snapshot writes, atomic publish, and run
   persistence. Controller logging now marks finalize and validate boundaries;
   deeper game-side progress/timing remains recommended.

## Immediate code change already made during this audit

The controller now logs:

- `run.finalize` started/completed
- `validate` started/completed

This turns the previously blank post-batch pause into visible phase boundaries.
The deeper performance work remains: instrument and optimize finalize internals,
especially sprite readback/PNG export.

## Recommended next remediation order

1. Fix tag ID fallback behavior and tests.
2. Make item/category relationships GUID-only or explicitly diagnosed when
   legacy/name matching is used.
3. Add finalize timing/progress instrumentation in the mod, then measure live
   `ReadPlannedItemChunks`, non-item extraction, asset export, JSON writes,
   publish, and run-state save.
4. Make chunk writes atomic.
5. Remove or manifest-gate `sync:generated`.
6. Add generated-validator freshness enforcement.
7. Add diagnostics or failure for slug fallback.
8. Batch/SQL-filter site read-model hydration paths.

## Healthy patterns to preserve

- Descriptor loading validates schema and folder/id consistency.
- Release artifact staging validates manifests, source kind, fatal diagnostics,
  hashes, SQLite metadata, and asset tree hash.
- SQLite emission writes temp then renames.
- Relationship graph centralizes public nodes, slug uniqueness, edges, and
  diagnostics.
- Controller validates HotRepl command presence/kind/version before export work.
