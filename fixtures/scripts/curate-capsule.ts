#!/usr/bin/env bun
/**
 * curate-capsule: deterministic curation of a real-derived boundary capsule.
 *
 * Real curation starts from a stable BepInEx-extracted snapshot: select a small
 * number of representative item ids, write a `fixtures/real-capsule/snapshot/items.json`
 * containing only their rows (no scrubbing of runtime values), copy the manifest with
 * a curated counts map, and emit a fixture-manifest.json envelope listing the selected
 * ids and rationale.
 */
console.error("curate-capsule: real-capsule curation is not implemented yet");
process.exit(2);
