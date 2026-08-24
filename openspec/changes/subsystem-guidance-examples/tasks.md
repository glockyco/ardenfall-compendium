## 1. Generated read-model cutover example

- [ ] 1.1 Add a wrong and right cutover pair to the pipeline guidance.
- [ ] 1.2 Show the obsolete public path in the wrong version and its removal in the right version.
- [ ] 1.3 Cite `pipeline/src/entities/registry.ts` and `site/src/lib/server/read-models.ts` in the pair.

## 2. Typed rich-text example

- [ ] 2.1 Add a wrong and right rich-text pair to the site guidance.
- [ ] 2.2 Show raw markup in the wrong version and the typed read-model document in the right version.
- [ ] 2.3 Cite `site/src/lib/components/content/RichText.svelte` and the component consumer.

## 3. Relationship-link example

- [ ] 3.1 Add a wrong and right relationship-link pair to the pipeline and site guidance.
- [ ] 3.2 Show route-composed link text in the wrong version and pipeline-resolved target data in the right version.
- [ ] 3.3 Cite `pipeline/src/relationships/relationship-graph.ts` and `site/src/lib/components/relationships/EntityLink.svelte`.

## 4. Component-intake example

- [ ] 4.1 Add a wrong and right component-intake pair to the site guidance.
- [ ] 4.2 Show repeated route-local markup or an untyped shortcut in the wrong version.
- [ ] 4.3 Show typed props, token-backed styling, accessibility notes, and a route consumer in the right version.
- [ ] 4.4 Cite a component file and a route file that exist in the repository.

## 5. Guidance integrity gate

- [ ] 5.1 Extend the existing guidance integrity test in `tooling.test.ts` to require the four named pairs and validate every cited repository path.
- [ ] 5.2 Do not infer semantic correctness from prose keywords or copied implementation text; review each right example directly against its cited owner and observable result.
- [ ] 5.3 Keep the check focused on objective guidance integrity and do not add a parallel documentation test suite.

## 6. Verification

- [ ] 6.1 Run `bun test tooling.test.ts` and confirm that a missing cited path fails with the path in the diagnostic.
- [ ] 6.2 Run the repository formatter check on the changed guidance and test files.
- [ ] 6.3 Review each pair against its cited source and confirm the example contains no field inventory or complete function copied from implementation.
- [ ] 6.4 Run `openspec validate subsystem-guidance-examples --strict`.
- [ ] 6.5 Do not run release-only browser, live-export, or full-repository gates unless another change in the same commit affects those contracts.
