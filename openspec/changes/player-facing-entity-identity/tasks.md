## 1. Chain foundation

- [x] 1.1 Extract a `ParameterizedObject` through one shared resolver that returns each field's value and which node set it, and route the character and item extractors through it.
- [x] 1.2 Extract a character record as a leaf of that chain, so the record's own parameters resolve as its values and its parent resolves as its definition.
- [x] 1.3 Filter records by `CharacterRecord.IsEditorCreated()`, and report the authored and filtered counts in the run manifest.
- [x] 1.4 Cover all three in `mod-tests`: a clone-named copy whose parent is the authored definition, a placement that overrides merchant stock, and a runtime-created record.

## 2. Identity contract

- [x] 2.1 Add the `naming` block with `displayName`, `authoringLabel` and `policy` to `schemas/entity.schema.json`, and fail validation when a source omits its policy.
- [x] 2.2 Resolve a display name as own, inherited, generated, or absent, and export the provenance with the value.
- [x] 2.3 Export `customFriendlyID` as the authoring label, and make the entity-node writer reject a `designer-identifier` value as a label.
- [x] 2.4 Remove the item template exclusion, publish all 1,273 items, and mark templates as templates.

## 3. Race and name sets

- [x] 3.1 Add `character-race` and `name-set` descriptors, and extract races with their player-visible name and ordered name sets.
- [x] 3.2 Extract each name set once with its complete seed vocabulary, its generation order, and the races that use it.
- [x] 3.3 Link every character definition and placement that resolves a race, and diagnose the three definitions that resolve none: one authoring omission chain `base_creature` → `mon_ato` → `mon_ato-baby`.

## 4. Canonical data and read models

- [x] 4.1 Add `npcs.display_name`, `npcs.display_name_provenance`, `npcs.authoring_label`, `npcs.character_ref_json`, and the placement-owned faction, drop and merchant tables; remove `npcs.friendly_name`.
- [x] 4.2 Publish every character definition, with its template marking, its race, and what derives from it.
- [x] 4.3 Register `instance_of` with forward title `Character type` and inverse `Placements`, and project it from the definition reference.
- [x] 4.4 Resolve the reader-facing type as the nearest named ancestor with a race fallback, in one shared function.
- [ ] 4.5 Project placement-owned merchant stock as item provenance, so an item page names the character that sells it.
- [ ] 4.6 Compose the descriptive label for a runtime-named character, and disambiguate listings by containing location.

## 5. Availability

- [x] 5.1 Remove the `if (!asset.enabled) continue;` filter from `BuiltLookupTableLocationAssetSource`, and cover a disabled location in `mod-tests`.
- [x] 5.2 Add one shared availability notice, render it near the title and in listings, and word it as the authored flag.
- [x] 5.3 Replace the quest overview sentence and the `Disabled: Yes/No` rows with that notice, and show nothing when no flag is set.
- [x] 5.4 Mark a disabled location on the map layer and on its page.
- [x] 5.5 Report disabled, hidden and debug-only counts per family in the manifest.

## 6. Site

- [ ] 6.1 Move placements to `/characters` and definitions to `/character-types`, and delete `/placed-characters` with its components and accessors.
- [ ] 6.2 Render a character's type, race, name provenance, stock and drops, stating which values are the character's own.
- [ ] 6.3 Render a type's placements as map deep links, and a race's name sets with their vocabulary.
- [ ] 6.4 Rename the navigation entries and update the sitemap route list.
- [ ] 6.5 Emit redirects from every shipped `/placed-characters/<slug>` URL, and from a runtime-created record's URL to the character overview.

## 7. Fixtures and gate

- [x] 7.1 Extend the synthetic snapshot with a template definition, an own-named placement, an inherited-name placement, a generated-name placement, a merchant placement, a runtime-created record, and a disabled location.
- [ ] 7.2 Update `bun test pipeline/test`, `bun test site/test` and the fixture checks for the new tables, provenance and routes.
- [ ] 7.3 Run the full gate in `AGENTS.md`; the live export counts and diagnostics are recorded in the extraction plans.
- [ ] 7.4 Verify reproducibility: export twice in one session and assert equal counts per family.

## 8. Documentation and cleanup

- [x] 8.1 Record live placement ownership, definition linkage, and authored naming behaviour in the extraction plans.
- [x] 8.2 Correct the cell count in the plans: 27 loadable cell scenes and 607 cell assets, not 683 cells.
- [ ] 8.3 Record the slice and its measured evidence in the roadmap, and archive this change.
