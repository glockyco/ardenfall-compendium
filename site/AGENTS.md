# Site Agent Orientation

SvelteKit static; data is shipped as `static/data.sqlite` and queried in-browser via `sql.js-fts5`. The site **never** parses descriptors or schema files at runtime; it reads pipeline-emitted `site_*` tables from SQLite.

## Hard rules

- All SQLite access goes through `src/lib/store/`. Components must not call `getDb()` or `query()` directly.
- Design tokens live in `src/app.css`. Component styling references token names (`bg-primary`, etc.), never inline colours.
- shadcn-svelte components are owned: edit `src/lib/components/ui/*` freely; do not depend on a specific upstream version.
- Renderer registries (`sections`, etc.) merge typed exported maps at boot. No global `register()` calls.

## Layout

- `src/lib/components/ui/` — copied shadcn-svelte primitives (one-owner per file).
- `src/lib/entity/sections/` — built-in section renderers.
- `src/lib/entities/<id>/` — per-entity custom renderers.
- `src/lib/store/` — SQLite glue and accessors.
- `src/routes/` — pages.

## Deployment

- Deploy with `bun run --cwd site cf-deploy`; the script syncs `pipeline/dist/data.sqlite` into `site/static/data.sqlite`, builds, then runs Wrangler.
- Wrangler auth is operator-local: run `wrangler login` (or otherwise provide a valid Wrangler auth context) before deploying.
- CI verifies the deployable build; it does not deploy and does not assume Cloudflare API token/account secrets.
