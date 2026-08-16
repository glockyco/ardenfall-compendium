## Context

See proposal.md for the motivation. A triage read every active plan document against the implementation and against the archived change `2026-08-16-player-facing-entity-identity`, which holds the latest measurements. The triage produced four groups, and each group decides a different destination.

## Goals / Non-Goals

- Goal: every fact worth keeping has one owner that a test, a build, or a spec keeps honest.
- Goal: the deletion is a clean cut. No compatibility directory, no index of moved files, no redirect note.
- Non-Goal: preserving pre-OpenSpec slice history in a new document. Git holds it.
- Non-Goal: implementing any planned slice. The changes this creates stay unstarted.

## Decisions

### 1. A contract the code already obeys becomes a spec requirement, not a plan

The architecture document describes behaviour that ships. `pipeline/src/entities/registry.ts` is the sole dispatch registry and fails on a descriptor without an emitter. `pipeline/src/entities/location/canonicaliser.ts` converts world coordinates to map coordinates once. A spec states each as a requirement, so a change that breaks it must say so.

Where the document states a current-state count, the count is dropped. Its claim of eight descriptors is already false; the tree holds fifteen.

### 2. A measurement moves to the artifact that emits it, or it is deleted

`artifact-manifest.json` records family counts and hashes per release, and `diagnostics.json` records diagnostics per snapshot. A plan that restates them is a copy with no producer. Every count in the plan documents is therefore deleted rather than moved, including the ones that are still correct.

### 3. A game mechanism survives only inside the requirement it justifies

`CharName` caches on read. `RecordID` is not unique across records. `ParameterizedObject.parent` continues through a chain. Each of these explains why a requirement is shaped as it is, so each becomes one sentence inside that requirement. A mechanism that justifies nothing is deleted.

### 4. An open finding becomes a change, and a fixed one becomes history

Ten findings across the two audits are still open, and none is pinned by a test. Each becomes an unstarted change carrying the evidence that found it. A finding the plans list as fixed is deleted; the test that fixed it is the record.

### 5. A latent defect stays where the test already documents it

The rich-text parser treats `5 < 6` as a tag, and crossed-tag recovery drops the outer formatting. Both are pinned by tests that state the behaviour and the reason it is tolerated. Those tests are the record, and the audit rows are deleted.

### 6. The lost evidence is named rather than reconstructed

About twenty delivered slices have verification evidence in the roadmap and in no archived change. Writing retrospective changes for them would fabricate a planning history that never happened. The evidence is dropped, and this decision records why.

### 7. No test asserts that the directory stays gone

A test that reads the tree and fails on a path nothing produces is the anti-pattern this repository already removed once, when a staging test asserted the absence of legacy route files. The duplicate-sentence test in `tooling.test.ts` already fails when a requirement appears in two homes, which is the failure that matters. A returning directory is caught by review, not by a guard against absence.

## Risks / Trade-offs

- A spec requirement written from a plan can overstate what the code does. Mitigation: every requirement names the file that implements it, and the tasks require reading that file first.
- Deleting the roadmap removes the only browsable list of delivered work. Mitigation: `openspec list` shows changes, and the release artifact shows what is published.

## Rejected claims

| Claim                                                   | Contradicting file and symbol                                                                                                                                    | Disposition                                                                                                                                          |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| The map transform uses a negative world z value.        | `pipeline/src/entities/location/canonicaliser.ts`, `mapPointUnchecked`                                                                                           | Not rejected as a contract. The code maps world z directly to map y. This closes the mirroring question.                                             |
| Every run writes `diagnostics.json`.                    | `mod/src/Control/Handlers/RunFinalizeCommand.cs`, the diagnostics write branch                                                                                   | Rejected as a file-presence claim. The manifest always carries diagnostic totals. The file appears when the run produces diagnostics.                |
| JSON stores only payloads that no query reads.          | `pipeline/src/entities/item-category/read-models.ts`, `emitItemCategoryReadModels`, and `pipeline/src/entities/name-set/read-models.ts`, `emitNameSetReadModels` | Rejected as current behaviour. JSON queries remain an open finding for a later change.                                                               |
| The site reads only generated read models and metadata. | `site/src/lib/server/entities/location.ts`, `listLocations` and `getLocationPresentation`                                                                        | Rejected as current behaviour. These functions query canonical location tables. Site migration remains an open finding.                              |
| Canonical tables have no type-tag column of any kind.   | `pipeline/src/sql/ddl.ts`, `buildDDL`                                                                                                                            | Rejected as overbroad. The generated item root has a pipeline-owned `variant` discriminator. It does not duplicate a value derived by another table. |
| Portal instances have no standalone detail page.        | `entities/portal/entity.json`, `site.route`, and `pipeline/src/entities/portal/read-models.ts`, `emitPortalReadModels`                                           | Rejected as stale. The descriptor declares a portal route and detail sections, and the emitter writes portal presentation rows.                      |
