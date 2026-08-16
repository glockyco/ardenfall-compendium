## Why

Subsystem guidance lacks worked examples for several recurring design decisions. The release manifest `pipeline/artifacts/releases/0.0.10.91-20260816-0100458904850/artifact-manifest.json` records the generated outputs that these examples must keep aligned with their owners.

## What Changes

- Add a good example and a bad example for a generated presentation or read-model cutover.
- Add a good example and a bad example for typed rich text instead of raw markup.
- Add a good example and a bad example for relationship-graph link governance.
- Add a good example and a bad example for taking a new component into the site.
- Place each example in the subsystem guide that owns the decision.
- Show the observable result and the owning source in every good example.
- Explain the failure and the violated rule in every bad example.

## Capabilities

### New Capabilities

- `subsystem-guidance-examples`: worked subsystem-guide examples for generated read models, typed rich text, relationship links, and component intake.
