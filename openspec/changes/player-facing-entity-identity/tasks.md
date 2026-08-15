## 1. Identity contract

- [ ] 1.1 Add the `naming` block with `displayName`, `authoringLabel` and `policy` to `schemas/entity.schema.json`, and fail descriptor validation when a declared name source omits its policy.
- [ ] 1.2 Keep the item prototype rule where it is, record the game behaviour that justifies it in the item descriptor, and report the suppressed count in the manifest.
- [ ] 1.3 Make the entity-node writer reject a `designer-identifier` value as a label, with a contract error that names the entity and field.

## 2. Extraction

- [ ] 2.1 Read a placement's display name from its embedded character data through `Parameter.Get()`, and export whether the placement's own parameter `IsSet`.
- [ ] 2.2 Export `customFriendlyID` as the authoring label rather than as the name.
- [ ] 2.3 Resolve `StoredCharacterData.parent` to a `namedAsset` reference and export it as the placement's definition.
- [ ] 2.4 Cover the new extraction in `mod-tests`, including a clone-named copy whose parent is the authored definition, and a record with no stored character data.

## 3. Canonical data and read models

- [ ] 3.1 Add `npcs.display_name`, `npcs.display_name_is_own`, `npcs.authoring_label` and `npcs.character_ref_json`, and remove `npcs.friendly_name`.
- [ ] 3.2 Keep every character definition published, and record its name provenance as authored, inherited, generated or absent.
- [ ] 3.3 Publish every placement, titled by its resolved name, with its provenance stated and its location shown in listings for disambiguation.
- [ ] 3.4 Register `instance_of` in the relationship registry with forward title `Character type` and inverse title `Placements`, and project it from the definition reference.
- [ ] 3.5 Emit `character-race` rows with their name sets, and link every character to its race.
- [ ] 3.6 Keep a location page listing every placement found there, including placements that have no page, rendered with their map link.

## 4. Availability

- [ ] 4.1 Remove the `if (!asset.enabled) continue;` filter from `BuiltLookupTableLocationAssetSource`, and cover a disabled location in `mod-tests` so the exported flag can be false.
- [ ] 4.2 Add one shared availability notice component, render it near the title and in listings, and word it as the authored flag rather than as unreachability.
- [ ] 4.3 Replace the quest overview sentence and the `Disabled: Yes/No` detail rows with that component, and show nothing when no flag is set.
- [ ] 4.4 Mark a disabled location on the map layer and on its page.

## 5. Export reporting

- [ ] 5.1 Report own, inherited and absent display-name counts per family in the run manifest.
- [ ] 5.2 Report disabled, hidden and debug-only counts per family in the run manifest, and report none rather than zero for a family without such a flag.

## 6. Site

- [ ] 6.1 Move definitions to `/character-types` and named individuals to `/characters`, and delete `/placed-characters` with its components and accessors.
- [ ] 6.2 Render placements on a type page as map deep links, and the type on a character page.
- [ ] 6.3 Render dialogue for an unnamed quest character on the quest page, labelled with the quest's role label and stated as unnamed.
- [ ] 6.4 Rename the navigation entries and update the sitemap route list.
- [ ] 6.5 Emit redirects from every shipped `/placed-characters/<slug>` URL to the new page, the type page, or the map position.

## 7. Fixtures and gate

- [ ] 7.1 Extend the synthetic snapshot with a nameless prototype definition, an own-named placement, an inherited-name placement, a placement with no character data, and a disabled location.
- [ ] 7.2 Update `bun test pipeline/test`, `bun test site/test` and the fixture checks for the new tables and routes.
- [ ] 7.3 Run the full gate in `AGENTS.md`, then a live export, and record counts and diagnostics.

## 8. Documentation and cleanup

- [ ] 8.1 Correct `docs/plans/2026-08-03-extraction-coverage.md` and `docs/plans/2026-08-04-item-character-inheritance.md`, both of which state that characters are nameless and that a placement cannot be linked to a definition.
- [ ] 8.2 Record the slice and its measured evidence in the roadmap, and archive this change.
