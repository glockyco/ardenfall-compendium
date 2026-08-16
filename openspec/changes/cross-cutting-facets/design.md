## Context

Slice 10 keeps broad facets planned after search. The map already has filter handling. Item overviews already emit `item_overview_filters` beside item rows.

The item read model creates filter options from emitted item variants. The item route reads those options from the generated table. The map route reads layer filter names from `map_layers.filters_json`.

Other entity families need the same pipeline-owned path. A route must not become the owner of facet values or labels.

## Goals and non-goals

**Goals:**

- Generate facet options from descriptor declarations and emitted rows.
- Extend the existing `item_overview_filters` read model.
- Preserve and extend `map_layers.filters_json` for map filter metadata.
- Expose applied facets in reader-facing page content.
- Render a stable empty state when a facet has no matches.

**Non-goals:**

- Replacing Pagefind search.
- Adding FTS5.
- Defining a new taxonomy for entity families.
- Moving filtering rules into site components.

## Decisions

### 1. Descriptors declare facet fields

A family declares its supported facet fields in its descriptor. Pipeline emission reads those declarations and creates the filter read model for that family.

The declaration identifies the source field and filter kind. The emitted rows provide the available values. The descriptor does not provide a second hard-coded option list.

### 2. Existing filter metadata remains the compatibility boundary

Item facets extend `item_overview_filters`, which already stores filter id, label, kind, and serialized options. Existing item readers keep using that generated shape while additional families use the canonical read-model path.

Map filter metadata remains in `map_layers.filters_json`. The pipeline extends that descriptor-owned metadata instead of adding route literals. The map route continues to read the generated layer declarations.

### 3. Values and labels are pipeline-owned

The pipeline derives option values from emitted rows and derives labels from descriptor metadata or emitted presentation data. Site routes receive complete options and do not reconstruct labels.

An option disappears when no emitted row supplies its value. This keeps stale choices out of reader-facing controls.

### 4. Applied state is visible in page content

A selected facet is represented in the page's reader-facing content. The statement uses the generated facet and option labels. Clearing the selection removes the statement and restores the unfiltered set.

A selection with no matching rows keeps the page and selected control visible. It renders the existing empty-result pattern rather than omitting the result component.

### 5. URL state remains bounded and shareable

Facet selections use the route's existing client state mechanism where a route already supports hydration. The pipeline remains the source of valid values. Unknown or stale URL values do not create new options.

## Risks and trade-offs

- More read-model rows increase release output, but they remove duplicated route logic.
- Descriptor declarations can expose fields with poor labels, so emission must diagnose missing labels.
- A facet value can disappear between releases, so stale URL state must resolve to no selection rather than fabricated data.
