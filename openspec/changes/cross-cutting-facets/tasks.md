## 1. Descriptor facet declarations

- [ ] 1.1 Extend descriptor validation for declared facet fields and filter kinds.
- [ ] 1.2 Add facet declarations for the supported entity families.
- [ ] 1.3 Keep descriptor labels and source fields available to metadata emission.

## 2. Pipeline filter read models

- [ ] 2.1 Generalise the generated filter read-model shape from `item_overview_filters`.
- [ ] 2.2 Emit item facets through `item_overview_filters` without route-owned options.
- [ ] 2.3 Emit filter metadata for each declared entity family from its rows.
- [ ] 2.4 Extend `map_layers.filters_json` from descriptor declarations without changing its layer contract.
- [ ] 2.5 Diagnose a declared facet whose source field or label is missing.

## 3. Canonical site read-model access

- [ ] 3.1 Add a canonical reader for generated facet rows and option labels.
- [ ] 3.2 Validate generated facet JSON before site code consumes it.
- [ ] 3.3 Add generated facet counts to release metadata and required-output checks.

## 4. Reader-facing filtering

- [ ] 4.1 Pass generated facet options into each supported family overview.
- [ ] 4.2 Remove route-owned facet value and label lists.
- [ ] 4.3 State the applied facet and value in reader-facing page content.
- [ ] 4.4 Keep the selected facet visible and render the empty state when no rows match.
- [ ] 4.5 Preserve bounded URL state for routes that already hydrate filter controls.

## 5. Behavioural verification and gate

- [ ] 5.1 Verify options change when emitted rows add or remove a facet value.
- [ ] 5.2 Verify an applied facet narrows rows and states its generated label.
- [ ] 5.3 Verify a valid facet with no matches renders an empty result state.
- [ ] 5.4 Verify map filters continue to load from `map_layers.filters_json`.
- [ ] 5.5 Run the pipeline and site release checks against synthetic and live-shaped exports.
