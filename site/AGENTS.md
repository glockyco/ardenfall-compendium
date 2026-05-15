# Site Agent Orientation

SvelteKit static-first site. Generated data is shipped as `static/data.sqlite` plus `static/assets/*.webp`, then read at build time by server-only route loaders so ordinary pages prerender to HTML. The site **never** parses descriptors or schema files at runtime; it reads pipeline-emitted `site_*` tables from SQLite.

## Hard rules

- Default route architecture is SSR + prerender + no CSR. Generated compendium pages should be static HTML served by Cloudflare Workers Static Assets. Opt into CSR or request-time Worker rendering only with a documented route-level reason.
- Build-time SQLite access goes through `src/lib/server/read-models.ts`. Components must not open SQLite directly.
- Design tokens live in `src/app.css`. Component styling references token names (`bg-primary`, etc.), never inline colours.
- shadcn-svelte components are owned: edit `src/lib/components/ui/*` freely; do not depend on a specific upstream version.
- Renderer registries (`sections`, etc.) merge typed exported maps at boot. No global `register()` calls.

## Layout

- `src/lib/components/ui/` — copied shadcn-svelte primitives (one-owner per file).
- `src/lib/entity/sections/` — built-in section renderers.
- `src/lib/entities/<id>/` — per-entity custom renderers.
- `src/lib/server/` — server-only build-time read models for prerendering.
- `src/routes/` — pages.

## Deployment

- Production deploys use `bun run --cwd site deploy:production ../pipeline/artifacts/releases/<snapshot-id>`. The command validates `artifact-manifest.json`, stages generated files into `site/static`, builds, smokes, deploys, and runs production release smoke.
- `site/static` is a staging cache. Its generated files must come from exactly one validated artifact and can be deleted/recreated at any time.
- Fixture builds use `bun run --cwd site build:fixture` after `bun run artifact:fixture synthetic fixtures/synthetic/snapshot`; fixture artifacts are valid for tests but must never be accepted by production deploy scripts.
- `bun run --cwd site build` must leave generated HTML under `.svelte-kit/cloudflare` for ordinary routes such as `/items` and `/items/[id]`; these should be static assets, not empty SPA shells.
- Wrangler auth is operator-local: run `wrangler login` (or otherwise provide a valid Wrangler auth context) before deploying.
- CI verifies the fixture build; it does not deploy and does not assume Cloudflare API token/account secrets.
