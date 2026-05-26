# Architecture Cleanup and Artifact Hardening Design

Date: 2026-05-26
Status: Accepted for implementation planning

## Purpose

Tighten the existing artifact/read-model architecture before the next content
slices add more entity types and public routes. The current one-way pipeline is
sound, but several implementation seams are becoming load-bearing: public routes
are partly label-derived, read-model emitters are centralising by accretion, the
item overview hydrates more data than it needs, SQLite artifact checks should be
explicit, and descriptor coverage failures should be direct.

This slice is a cleanup and hardening pass. It does not add new public content,
new HotRepl security behavior, map work, search, or presentation features.

## Scope

Implement these changes as one slice with regular atomic commits:

1. Stable descriptor-owned public route paths.
2. Entity-owned read-model modules with a thin registry/facade.
3. Lean item overview data that does not bulk-attach full presentation tooltips.
4. SQLite artifact validation for integrity and deploy-safe sidecar state.
5. A Worker `nodejs_compat` audit, removing it only if existing builds/smokes pass.
6. Direct descriptor coverage diagnostics when an entity lacks required pipeline
   or site support.

The HotRepl remote-bind concern is intentionally out of scope for this slice.

## Design decisions

### 1. Public route paths are explicit descriptor data

Add explicit public route metadata to entity descriptors. A public entity must
own a stable route path such as `/items`, `/categories`, `/tags`, or `/stats`.
The pipeline must emit `site_entities.route_path` from this descriptor field,
not from `label.plural` or any other presentation text.

The descriptor schema should reject malformed route paths. Route paths must be
absolute, lowercase, slash-prefixed, and free of trailing slashes except `/`.
Changing a label must never change a public URL.

### 2. Read-model code becomes entity-owned

Split the central read-model emitters/accessors into entity-owned modules while
keeping stable facade imports for current callers.

Pipeline target shape:

```text
pipeline/src/entities/item/read-models.ts
pipeline/src/entities/item-category/read-models.ts
pipeline/src/entities/item-tag/read-models.ts
pipeline/src/entities/stat-type/read-models.ts
pipeline/src/stages/emit-read-models.ts      # thin orchestrator/facade
```

Site target shape:

```text
site/src/lib/server/entities/item.ts
site/src/lib/server/entities/item-category.ts
site/src/lib/server/entities/item-tag.ts
site/src/lib/server/entities/stat-type.ts
site/src/lib/server/read-models.ts           # shared DB helpers + facade exports
```

This is not a generic abstraction rewrite. Each entity module remains explicit
and typed. The central files should only coordinate shared database access,
registry merging, and backwards-compatible exports.

### 3. Descriptor coverage fails clearly

The pipeline must fail with direct diagnostics when a descriptor is present but
required executable support is absent. At minimum, every loaded public descriptor
must have:

- a canonicalizer or an explicit declaration that it is metadata-only;
- read-model emission support when it has public routes or site metadata;
- a route path when it is public.

The failure should name the descriptor id and the missing support surface, rather
than failing later with a generic missing table or route error.

### 4. Item overview data is lean

The item overview currently attaches full presentation rows to every overview
row so tooltips can be rendered from the overview payload. That does not scale
with richer presentation contracts and forces CSR payload growth on `/items`.

Change the overview read model/accessor so `/items` receives only the data it
needs to render the overview table, filters, category links, names, icons,
weights, values, variants, and stable item links. Full `item_presentation_rows`
remain the detail/tooltip contract, but they are not bulk-joined into the item
overview page payload.

The visible static overview page remains functional. Tooltip/focus-card behavior
on the overview may degrade to the lean summary data unless a narrow per-item
static/data path already exists and can be used without reintroducing bulk
payloads. Do not add browser SQLite or a new request-time Worker path in this
slice.

### 5. SQLite artifacts are validated after close

After emitting `data.sqlite`, validate the file as a deployable static artifact:

- the database closes cleanly before publish;
- no `data.sqlite-wal` or `data.sqlite-shm` sidecars remain;
- `PRAGMA integrity_check` returns `ok`;
- artifact manifest hashing happens after validation and final file placement.

`PRAGMA journal_mode = DELETE` remains the right deploy format because static
artifacts should not depend on WAL sidecars or write permissions.

### 6. Worker `nodejs_compat` is audited, not assumed

Try removing `compatibility_flags = ["nodejs_compat"]` from `site/wrangler.toml`.
If existing site build and smoke checks pass without it, remove the flag. If a
real dependency still requires it, keep the flag and add a short comment stating
why it is still required.

Do not replace this with a broader Worker architecture change.

## Data flow after the slice

```text
entities/<id>/entity.json
  -> load-descriptors validates id + route + descriptor shape
  -> coverage check verifies matching subsystem support
  -> entity canonicalizers write canonical SQLite tables
  -> entity read-model emitters write site/read-model tables
  -> site server read-model modules read generated tables at build time
  -> prerendered routes receive lean route-specific props
```

## Error handling

Descriptor errors should be early and specific. Examples:

- `descriptor 'stat-type' is missing site.route`
- `descriptor 'location' has no pipeline canonicalizer`
- `descriptor 'location' has no read-model emitter for public route '/locations'`
- `SQLite artifact has unexpected WAL sidecar: data.sqlite-wal`
- `SQLite integrity_check failed: <details>`

Errors should fail the build or artifact command. They should not produce partial
release artifacts.

## Testing and verification

Implementation must include focused coverage for the new contracts:

- descriptor schema/loader rejects missing or invalid public routes;
- emitted `site_entities.route_path` is descriptor-derived;
- descriptor coverage check reports missing support by descriptor id;
- item overview accessor no longer attaches full presentation rows;
- SQLite validation rejects WAL/SHM sidecars and failed integrity checks where
  practical to simulate;
- site fixture build/smoke proves `/items` and item detail routes still render;
- Worker build/smoke determines whether `nodejs_compat` can be removed.

Final verification should run the directly affected pipeline, tooling, and site
checks rather than relying only on typechecking.
