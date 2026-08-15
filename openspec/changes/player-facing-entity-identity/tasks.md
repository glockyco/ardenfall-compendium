## 1. Identity contract

- [ ] 1.1 Add the `naming` block with `displayName`, `authoringLabel` and `policy` to `schemas/entity.schema.json`, and fail descriptor validation when a declared name source omits its policy.
- [ ] 1.2 Add `isDisplayName` as one shared predicate in the pipeline, move the item `BASE`/`PLACEHOLDER`/`{token}` rule onto it, and prove by test that the 73 suppressed item prototypes stay suppressed.
- [ ] 1.3 Make the entity-node writer reject a `designer-identifier` value as a label, with a contract error that names the entity and field.

## 2. Extraction

- [ ] 2.1 Read a placement's display name from its embedded character data through `Parameter.Get()`, and export whether the placement's own parameter `IsSet`.
- [ ] 2.2 Export `customFriendlyID` as the authoring label rather than as the name.
- [ ] 2.3 Resolve `StoredCharacterData.parent` to a `namedAsset` reference and export it as the placement's definition.
- [ ] 2.4 Report own, inherited and absent display-name counts per family in the run manifest.
- [ ] 2.5 Cover the new extraction in `mod-tests`, including a clone-named copy whose parent is the authored definition, and a record with no stored character data.

## 3. Canonical data and read models

- [ ] 3.1 Add `npcs.display_name`, `npcs.display_name_is_own`, `npcs.authoring_label` and `npcs.character_ref_json`, and remove `npcs.friendly_name`.
- [ ] 3.2 Classify prototypes with the shared predicate in the character read model, and stop publishing definitions that resolve no display name.
- [ ] 3.3 Publish a placement page only when its display name is its own, and emit the diagnostics for the inherited and absent cases.
- [ ] 3.4 Register `instance_of` in the relationship registry with forward title `Character type` and inverse title `Placements`, and project it from the definition reference.
- [ ] 3.5 Suppress `instance_of` when the definition resolves no display name, and record `characterTypeUnpublishable`.

## 4. Site

- [ ] 4.1 Move definitions to `/character-types` and named individuals to `/characters`, and delete `/placed-characters` with its components and accessors.
- [ ] 4.2 Render placements on a type page as map deep links, and the type on a character page.
- [ ] 4.3 Render dialogue for an unnamed quest character on the quest page, labelled with the quest's role label and stated as unnamed.
- [ ] 4.4 Rename the navigation entries and update the sitemap route list.
- [ ] 4.5 Emit redirects from every shipped `/placed-characters/<slug>` URL to the new page, the type page, or the map position.

## 5. Fixtures and gate

- [ ] 5.1 Extend the synthetic snapshot with a nameless prototype definition, an own-named placement, an inherited-name placement, and a placement with no character data.
- [ ] 5.2 Update `bun test pipeline/test`, `bun test site/test` and the fixture checks for the new tables and routes.
- [ ] 5.3 Run the full gate in `AGENTS.md`, then a live export, and record counts and diagnostics.

## 6. Documentation and cleanup

- [ ] 6.1 Correct `docs/plans/2026-08-03-extraction-coverage.md` and `docs/plans/2026-08-04-item-character-inheritance.md`, both of which state that characters are nameless and that a placement cannot be linked to a definition.
- [ ] 6.2 Record the slice and its measured evidence in the roadmap, and archive this change.
