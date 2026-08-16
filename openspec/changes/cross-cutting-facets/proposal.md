## Why

The site has filter support for the map but not across entity families. The release manifest `pipeline/artifacts/releases/0.0.10.91-20260815-2245519526240/artifact-manifest.json` records generated item filter output. Broad facets need one pipeline-owned read model instead of page-specific filter logic.

## What Changes

- Define broad facets that work across the supported entity families.
- Generate filter read models in the pipeline alongside the existing filter tables.
- Expose generated facet data through the canonical site read-model path.
- Keep filter values and labels owned by the pipeline rather than by site components.
- Add the generated read models to release output and reader-facing filtering.

## Capabilities

### New Capabilities

- `cross-cutting-facets`: broad entity facets and pipeline-generated filter read models for site filtering.
