## 1. Release decisions and evidence

- [ ] 1.1 Decide whether production strips debug-only locations or gates them server-side, and record the release evidence.
- [ ] 1.2 Decide whether `sk_unarmed` keeps a public page or becomes non-public, and record the route policy.
- [ ] 1.3 Identify the runtime source for recipe label arguments, or approve a neutral fallback when no stable binding exists.

## 2. Debug-only location visibility

- [ ] 2.1 Apply the chosen debug-only location policy to the canonical snapshot and route index.
- [ ] 2.2 Apply the same policy to map points, indexes, search results and direct routes.
- [ ] 2.3 Remove any client-only path that can reveal a location excluded by the release policy.
- [ ] 2.4 Add a hydrated production smoke that exercises the client toggle and direct route.

## 3. Vestigial skill publication

- [ ] 3.1 Implement the selected `sk_unarmed` publication status in route generation and indexes.
- [ ] 3.2 Mark a retained page as vestigial, or remove every public navigation path for a non-public skill.
- [ ] 3.3 Add a reader-model test for the selected status and its direct-route response.

## 4. Recipe labels

- [ ] 4.1 Export and validate the stable recipe label binding if the decision selects runtime resolution.
- [ ] 4.2 Otherwise implement the neutral fallback and retain the source label in provenance only.
- [ ] 4.3 Add a rendered-page check that rejects brace placeholders in item labels.

## 5. Release verification

- [ ] 5.1 Verify the chosen debug-content policy against a fixture and a live release export.
- [ ] 5.2 Verify the chosen vestigial-skill policy against indexes, relationships and direct navigation.
- [ ] 5.3 Verify resolved and unresolved recipe labels in a browser against the hydrated release page.
- [ ] 5.4 Run the repository gate and archive this change after all checks pass.
