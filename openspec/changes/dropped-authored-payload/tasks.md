## 1. Field inventory

- [ ] 1.1 Compare each confirmed game type with its extractor and consumer, and record the complete reader-facing field inventory.
- [ ] 1.2 Decide the typed, relationship and structured-data shape for faction modifiers, melee effects, enchantments and status chains.
- [ ] 1.3 Record the chosen identity and missing-reference diagnostics for every new relationship.

## 2. Item and effect extraction

- [ ] 2.1 Extend faction-tag extraction with modifier groups, affected factions and stack behaviour.
- [ ] 2.2 Extend melee extraction with the omitted reader-facing combat and bleed values.
- [ ] 2.3 Extend equipment extraction with ordinary and built-in enchantment entries, levels and references.
- [ ] 2.4 Extend status-effect extraction with modification targets and their authored adjustments.
- [ ] 2.5 Add extractor tests for populated, empty and unresolved references in each family.

## 3. Perk and trait families

- [ ] 3.1 Add source, snapshot and extractor contracts for authored perks.
- [ ] 3.2 Add source, snapshot and extractor contracts for authored traits.
- [ ] 3.3 Add identity, icon and reference diagnostics for perk and trait rows.
- [ ] 3.4 Add extractor tests for perk requirements, perk effects and trait stat requirements.

## 4. Canonical projection and pages

- [ ] 4.1 Canonicalise the new item, status, perk and trait data without duplicating source-of-truth fields.
- [ ] 4.2 Register relationship predicates for factions, enchantments, status chains, perk effects and trait requirements.
- [ ] 4.3 Render item, status, perk and trait pages with empty-state and unresolved-reference behaviour.
- [ ] 4.4 Add reader-model tests that assert the new values and links are visible.

## 5. Release verification

- [ ] 5.1 Export a fixture and a live release, then compare counts, references and diagnostics for every new family.
- [ ] 5.2 Verify a reader can reach each published perk and trait page from the relevant index or relationship.
- [ ] 5.3 Run the repository gate and archive this change after all checks pass.
