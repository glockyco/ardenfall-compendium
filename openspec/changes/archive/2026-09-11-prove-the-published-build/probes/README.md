# Probes for the published-build proof

## Baseline, recorded 2026-09-11 (tasks 1.1 to 1.3)

The store held **54 snapshots**. 35 carried `productName` and `buildProfile`; **19 did not**, all
exported on 2026-08-15 and 2026-08-16, before the mod recorded the answering game. Every snapshot
that carries an identity reports `Ardenfall Demo 2025`, so no snapshot in the store came from the
alpha; the gap is an absent proof rather than a foreign one.

`pipeline/artifacts/releases` held **32 release artifacts**, of which **14** carried no
`source.productName`. They are the artifacts built from the 19 identity-less snapshots.

Scoped tests at the baseline: mod 267 passed, controller 55 passed, pipeline 264 passed.

## Decision on the existing store (task 6.1)

The 19 snapshots are **retired, not re-exported**. A re-export cannot recover their identity: the
game they answered is gone, and asserting it now would be a claim rather than a record. They move to
`snapshots/retired/`, and the 14 artifacts built from them move to `pipeline/artifacts/retired/`, so
the release store holds nothing whose source cannot be proved. Both directories stay local, as the
snapshot store already does.

## Verification (task 8)

- **8.1** The live export `0.0.10.91-20260911-1300226367980` records
  `productName: "Ardenfall Demo 2025"` and `buildProfile: "release"`, and the artifact carries both
  under `source`, so an artifact can be audited without its snapshot.
- **8.2** The export refusal is exercised against a foreign product name in
  `controller/test/export-orchestrator.test.ts`, which asserts the message names the publication
  embargo. A live alpha export was **not** run: it would require installing the BepInEx loader into
  the alpha install, which the embargo work does not need and which the plan's own non-goals keep
  out of scope. The read-only half of the rule is unchanged: an alpha probe runs from `spikes/` and
  writes no snapshot.
- **8.3** Run against a real identity-less snapshot from the retired set,
  `bun run artifact:release snapshots/retired/0.0.10.91-20260815-0654441329660` fails with
  "publication identity is unproven: snapshot manifest requires productName and buildProfile", and
  writes no artifact directory.
