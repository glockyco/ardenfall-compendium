## 1. Architecture contracts become specs

- [x] 1.1 Read `pipeline/src/entities/registry.ts`, `pipeline/src/stages/`, and the mod's snapshot writer, then write `specs/entity-extraction/spec.md` for the live source, the sole dispatch registry, the preflight, and the atomic snapshot with its manifest and diagnostics.
- [x] 1.2 Read `pipeline/src/entities/*/read-models.ts` and `site/src/lib/server/`, then write `specs/canonical-data/spec.md` for typed domain-shaped tables, the prohibition on entity-attribute-value storage, JSON only for payloads nothing queries, the generated read models, and the site reading read models only.
- [x] 1.3 Read `pipeline/src/relationships/`, then write `specs/relationship-graph/spec.md` for nodes, edges, sections, the single predicate registry, the missing-target audit, and disambiguated link text.
- [x] 1.4 Read `pipeline/src/entities/location/canonicaliser.ts` and `pipeline/src/map/read-models.ts`, then write `specs/placement-map/spec.md` for generalised placements, the coordinate transform performed exactly once, descriptor-owned layers, and a site that never transforms a coordinate.
- [x] 1.5 Add the identity domains and the missing-reference policy to `specs/entity-identity/spec.md` as modified requirements.
- [x] 1.6 Confirm every requirement against the file that implements it. Delete a requirement the code does not obey, and record it as an open finding instead.

## 2. Planned work becomes changes

- [x] 2.1 Create `tile-capture-basemap`, carrying the capture design, the suppression list, the checksum contract, the WebP pyramid, and the three open decisions on storage, interiors, and lighting seams.
- [x] 2.2 Create `cross-cutting-facets` for the remaining broad facets and the generated filter read models.
- [x] 2.3 Create `snapshot-versioning-diff-archive` for committed digests, the cross-version CLI, the raw archive, and the backend decision.
- [x] 2.4 Create `subsystem-guidance-examples` for the worked good and bad examples in the subsystem guides.
- [x] 2.5 Confirm that no created change duplicates `world-cell-content`, which already owns the scene traversal and the item provenance behind scene lists.

## 3. Open findings become changes

- [x] 3.1 Create `dropped-authored-payload` for the structured payload the extractor drops: `FactionItemTag.modifiers`, stat-type `affects` and `skillAffects`, location `fastTravelPosition` and `volumes`, the item combat and equipment fields, `StatusEffectData.modifyStatusEffects`, and the trait and perk families.
- [x] 3.2 Create `debug-content-visibility` for debug-only locations that a client toggle reveals in production, the vestigial `sk_unarmed` route, and the `Recipe of {0}` label whose runtime binding the snapshot does not hold.
- [x] 3.3 Create `item-index-payload` for the item index hydration cost, with the measured payload size as its evidence.
- [x] 3.4 Record in each change the probe or the release that found the finding, so a reader can repeat the measurement.

## 4. Citations move

- [x] 4.1 Replace the six plan citations in `.omp/RULES.md` with the spec, test, or code that now holds each rule.
- [x] 4.2 Remove the two plan references from `AGENTS.md`, and state where a document belongs: specs for what must be true, changes for work in flight, the change tracker for status.
- [x] 4.3 Repoint `mod/AGENTS.md` and `pipeline/AGENTS.md` so an unused or renamed game field is recorded at the extractor and in the spec it affects, not in a plan.
- [x] 4.4 Remove the three plan references from `README.md`, and point a reader at `openspec/specs/` and `openspec list`.
- [x] 4.5 Replace the export-contract reference in `.omp/skills/live-extraction/SKILL.md` with the controller code and the spec that hold the contract.
- [x] 4.6 Update the two plan references in `openspec/changes/world-cell-content/`.

## 5. The directory goes

- [x] 5.1 Delete `docs/`.
- [x] 5.2 Confirm that no tracked file references `docs/plans` or `docs/`.

## 6. Verification

- [x] 6.1 Run `openspec validate --all`.
- [x] 6.2 Run the full gate in `AGENTS.md`.
- [x] 6.3 Run a live export and a release build, and confirm the new specs describe what the artifact contains.
- [x] 6.4 Archive this change after the gate passes.
