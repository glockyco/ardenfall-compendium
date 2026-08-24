## Why

Steam holds two Ardenfall installs and they are different games. The Demo is public. The full game is a private alpha, and nothing extracted from it may be published. A reader of the compendium must never meet a fact that came from the alpha.

One check defends that boundary. `assertExpectedProductName` compares the connected game's Unity product name against `Ardenfall Demo 2025` and throws when it differs. It works, and it runs at the only moment the two installs are distinguishable: while the game is answering.

Two things weaken it.

The reason on record is the wrong one. The specification explains the check as a defence against two instrumented games sharing a HotRepl port, and the error text says the same: _"This usually indicates a port collision with another instrumented game."_ The skill describes the split as targeting, and it invites reading from the alpha, calling it _"the install to measure when a question is about world coverage."_ Nothing anywhere says the alpha is embargoed. Someone relaxing the assertion to support both installs would be following the documentation.

The artifact carries no proof. A snapshot manifest records `gameVersion`, `buildIdentifier`, `extractorVersion` and `extractedAt`, and no field naming the game. Searching the whole snapshot store for `productName` or `buildProfile` returns nothing, against a control that finds `Demo` in 57 files. So once data lands in the store, no downstream step can tell which install produced it, and no audit can answer the question afterwards.

## Goals

- A reader never meets alpha content, and the repository states that as the reason its checks exist.
- Every published artifact carries the identity of the game that produced it.
- A snapshot that cannot prove it came from the Demo is refused before it reaches the site.
- Read-only probes against the alpha stay possible in the spike area, but export snapshots remain Demo-only.

## Non-Goals

- Removing the product name assertion. It is correct and it stays.
- Blocking connections to the alpha. Measuring world coverage against it is deliberate, and the change protects publication rather than access.
- Changing the extraction contract, the entity families, or any read model.
- The port-collision protection, which is a separate concern the existing requirement already covers and which this change keeps.

## What Changes

- Record the publication embargo as the reason the boundary exists, in the specification, in the skill that describes the two installs, and in the failure the assertion raises.
- Record the identity of the answering game in the snapshot manifest, alongside the build and extractor fields already there.
- Refuse to publish a snapshot whose recorded identity is absent or is not the Demo, so the artifact is checked and not only the run.
- State in root guidance that only Demo-derived artifacts may be published.
- State in the skill that read-only probes against the alpha stay in the spike area, cannot create export snapshots, and never become published content.

## Capabilities

### Modified Capabilities

- `evidence-standard`: the requirement that an export proves which game answered it gains the embargo as its reason, extends from the run to the stored artifact, and gates publication on the recorded identity.

## Impact

- **Controller:** `controller/src/export-orchestrator.ts` records the observed product name and build profile, and its failure names the embargo.
- **Snapshot format:** the manifest gains identity fields. Existing snapshots lack them, so the publication gate treats an absent identity as a refusal rather than as a pass.
- **Pipeline:** publication checks the recorded identity before it emits artifacts.
- **Documentation:** `AGENTS.md` states the repository-wide publication boundary. `.omp/skills/live-extraction/SKILL.md` distinguishes read-only alpha probes from Demo-only exports where it describes the two installs.
- **Unaffected:** extraction, entity families, read models, routes, and the site.
