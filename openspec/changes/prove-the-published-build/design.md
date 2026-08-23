## Context

See proposal.md - Why.

### What the boundary is made of today

| claim                                | evidence                                                                                                                                                                                                                                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One check separates the two installs | `controller/src/export-orchestrator.ts:113` sets `EXPECTED_PRODUCT_NAME = "Ardenfall Demo 2025"`, and `:447` throws from `assertExpectedProductName` when the connected game reports anything else                                                                                       |
| Its stated reason is port hygiene    | The same throw reads _"This usually indicates a port collision with another instrumented game"_, and `openspec/specs/evidence-standard/spec.md` explains the requirement with the stale-instance incident                                                                                |
| The skill invites reading the alpha  | `.omp/skills/live-extraction/SKILL.md:61` calls `Ardenfall` _"the install to measure when a question is about world coverage"_                                                                                                                                                           |
| No document states the embargo       | Searched `README.md`, `AGENTS.md`, `CLAUDE.md`, and the skills for alpha, private, unreleased, embargo, and confidential. The only match concerns the licence, not publication of alpha content                                                                                          |
| The artifact records no identity     | A snapshot manifest holds `schemaVersion`, `gameVersion`, `buildIdentifier`, `extractorVersion`, `extractedAt`, `filteredRuntimeCreatedCount`. Grepping the snapshot store returns 0 files for `productName` and 0 for `buildProfile`, against a positive control of 57 files for `Demo` |

The last row follows the negative-result rule in `evidence-standard`: the absence is reported with the control that proves the search worked.

### Who owns what

```
mod/src/Dtos/Manifest.cs            the manifest shape
mod/src/Emit/ManifestBuilder.cs     builds it
mod/src/Emit/SnapshotWriter.cs:36   writes manifest.json into the snapshot
controller/src/export-orchestrator.ts:447   asserts the answering game
controller/src/validate-snapshot.ts:26      reads the snapshot manifest back
pipeline/src/artifacts/manifest.ts:59-60    carries build fields into the artifact
pipeline/src/artifacts/sqlite-validation.ts:40  publishValidatedSqlite, the atomic publish point
```

Only the mod can observe the live game's identity, so the field originates there. Only the pipeline decides what becomes an artifact, so the gate belongs there.

## Goals / Non-Goals

**Goals**

- The reason on record is the reason that matters, so the check survives a reader who tries to generalise it.
- Identity travels with the data, so an artifact can be audited without the session that produced it.
- The gate sits where content becomes published, not where a game is connected.

**Non-Goals**

- Preventing connections to the alpha. Measuring it is deliberate and documented.
- Replacing the product name assertion, which stays and keeps its port-collision role.
- Any change to entity families, read models, routes, or the site.
- Retrofitting identity into existing snapshots, which cannot be done honestly after the fact.

## Decisions

**The gate is at publication, not at connection.** Alternative: refuse to connect to the alpha at all. Rejected because the skill documents a legitimate reason to connect, and a rule that forbids a useful activity gets worked around. Guarding the point where content becomes public protects the property that matters and leaves the activity alone.

**Identity is recorded in the snapshot, not derived later.** The two installs are distinguishable only while a game is answering. After that, `gameVersion` alone cannot separate them. Recording it at the moment it is observable is the only honest option, and it is why the field originates in the mod rather than in the pipeline.

**An absent identity is a refusal, not a pass.** Every existing snapshot lacks the field. Treating absence as permission would make the gate pass for exactly the artifacts it cannot vouch for. Existing snapshots are re-exported or explicitly retired, and the tasks require that choice to be recorded.

**The failure text names the embargo.** The current message offers a port collision as the likely cause, which is true for one of the two conditions and misleading for the other. Naming both, with the publication consequence, is what stops the check being relaxed by someone who reads only the message.

**The skill keeps recommending the alpha, with a boundary attached.** Deleting the recommendation would lose a real capability. The sentence gains what happens to those measurements: they stay in the spike area, which the skill already establishes as the home for probes.

## Risks / Trade-offs

**A new required field breaks the snapshot contract for existing data.** → The gate distinguishes absent from wrong, and the tasks require the existing store to be re-exported or retired deliberately rather than grandfathered.

**Recording the identity says nothing if the recorder is the thing that is wrong.** → It is defence in depth, not a replacement. The connection-time assertion still runs, and the two fail independently.

**A reader could still copy alpha measurements into published prose by hand.** → Out of reach of any automated gate. The skill states the rule, which is the only control that applies to prose.

## Migration Plan

1. Add the identity fields to the manifest shape and populate them in the mod, then export once and confirm the values describe the connected game.
2. Carry the fields through snapshot validation and into the artifact manifest.
3. Add the publication gate, then confirm it refuses a snapshot with an absent identity and one naming another game.
4. Decide the fate of the existing snapshot store, re-exporting or retiring it, and record the decision.
5. Update the specification, the failure text, and the skill in the same slice as the code they describe.

Rollback is per commit. The gate is the last code step, so the recording can land and be observed before anything starts refusing.
