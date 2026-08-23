## 1. Baseline

- [ ] 1.1 Record which identity fields the snapshot manifest holds today, and confirm with a positive control that `productName` and `buildProfile` appear in no snapshot.
- [ ] 1.2 Record the current snapshot store contents, so step 6 can name exactly which snapshots the gate will refuse.
- [ ] 1.3 Record the current scoped test results for `mod`, `controller`, and `pipeline`.

## 2. Mod: observe and record the identity

- [ ] 2.1 Add the answering game's Unity product name and build profile to the manifest shape in `mod/src/Dtos/Manifest.cs`.
- [ ] 2.2 Populate both from the live game in `mod/src/Emit/ManifestBuilder.cs`, reading what the runtime reports rather than a compiled-in constant.
- [ ] 2.3 Confirm `mod/src/Emit/SnapshotWriter.cs` writes the new fields into `manifest.json`.
- [ ] 2.4 Run the mod tests.

## 3. Controller: fail on the wrong game for the right reason

- [ ] 3.1 Extend the failure in `controller/src/export-orchestrator.ts` so it names the publication embargo as well as the port collision, and states that content from the other install must not be published.
- [ ] 3.2 Accept the new manifest fields in `controller/src/validate-snapshot.ts` and fail when they are absent from a fresh export.
- [ ] 3.3 Add a test asserting the failure text names the embargo, so a later edit cannot quietly reduce it to a port-collision message.
- [ ] 3.4 Run the controller tests.

## 4. Pipeline: carry the identity into the artifact

- [ ] 4.1 Carry the product name and build profile through `pipeline/src/artifacts/manifest.ts` beside `buildIdentifier` and `extractorVersion`.
- [ ] 4.2 Confirm the emitted artifact manifest exposes them, so an artifact can be audited without its snapshot.
- [ ] 4.3 Run the pipeline tests.

## 5. Pipeline: gate publication

- [ ] 5.1 Refuse publication when the recorded identity names a game other than the published one, before `publishValidatedSqlite` runs.
- [ ] 5.2 Refuse publication when the recorded identity is absent, and say that an unproven source is not a proven one.
- [ ] 5.3 Add tests for both refusals and for the passing case, using synthetic fixtures rather than a live export.
- [ ] 5.4 Confirm the refusal happens before any artifact is written, not after.

## 6. Existing snapshots

- [ ] 6.1 Decide whether the snapshots recorded in task 1.2 are re-exported or retired. Record the decision and its reason.
- [ ] 6.2 Apply that decision, so no snapshot remains that the gate would refuse for an absent identity.

## 7. Documentation

- [ ] 7.1 State the embargo in `.omp/skills/live-extraction/SKILL.md` where it describes the two installs, so the reason sits beside the mechanism.
- [ ] 7.2 Keep the recommendation to measure the alpha for coverage questions, and state that those measurements stay in the spike area and never become published content.
- [ ] 7.3 Confirm no document now describes the split as targeting alone.

## 8. Verification

- [ ] 8.1 Run a live export against the Demo and confirm the snapshot records the identity, and that the values describe the connected game.
- [ ] 8.2 Confirm an export against the other install fails, and that the failure names the embargo.
- [ ] 8.3 Confirm publication refuses a snapshot with an absent identity and one naming another game.
- [ ] 8.4 Run the full gate in `AGENTS.md`.
- [ ] 8.5 Run `openspec validate prove-the-published-build --strict`.
- [ ] 8.6 Confirm the delta merges cleanly against `openspec/specs/evidence-standard/spec.md`, keeping the two scenarios the existing requirement already carries.
