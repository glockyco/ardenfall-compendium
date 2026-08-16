# Site Agent Orientation

- Read pipeline-emitted `site_*` tables from SQLite in server-only build-time loaders. Never parse descriptors or schema files at runtime.
- Stage generated data as `.data/data.sqlite` and `static/assets/*.webp`. Prerender ordinary pages to HTML.

## Hard rules

- Meet WCAG 2.2 Level AA.
- Run `smoke:accessibility` against built HTML. Treat its checks as limited to duplicate link text, target dimensions below 24 px, and live-region presence. It does not inspect client updates, focus, or browser layout.
- Use SSR, prerendering, and no CSR for ordinary routes. Opt into CSR or request-time rendering only with a documented route-level reason.
- Give `/search` CSR because Pagefind reads its index in the browser. Prerender its shell and message for readers without JavaScript. Build the index with `build:prepared`, and reject absent or empty indexes with `smoke:pagefind`.
- Render the label supplied by the read model. Do not add an unnamed fallback in a site accessor.
- Keep identifiers out of labels. Pass listings with possible duplicate labels through `disambiguateLabels`; it can append a short id only to resolve an accessible-name collision under WCAG 2.4.4.
- List every database row, including nameless rows.
- Render a relationship target without a page as plain text, not a link. Read page status for each row.
- Never render raw game or TMP strings. Render only the translated document supplied by read models.
- Store design tokens in `src/app.css`. Use token-backed Tailwind utilities or CSS variables. Define a matching theme variable for every colour utility. Pair every `border` with an explicit colour.
- Use `border-input-border` for control boundaries because it meets WCAG 1.4.11's 3:1 contrast. Use `border-border` only for decorative edges.
- Keep the build database in private `.data/`, outside the served root. Publish only `static/assets/` and `static/_release.json`.
- Deploy files only. Keep `adapter-static` without a Worker and `wrangler.toml` without `main`. Set `not_found_handling = "404-page"`. Revisit this decision before adding request-time rendering.
- Edit owned shadcn-svelte primitives in `src/lib/components/ui/*` without depending on an upstream version. Add only primitives that a page consumes.

## Layout

- Put owned UI primitives in `src/lib/components/ui/`, entity presentation in `src/lib/components/<entity>/`, server-only loaders in `src/lib/server/`, and pages in `src/routes/`.

## UI governance

- Inspect `src/lib/components/` before adding a shared component. Give each new component typed props, token-backed styling, and accessibility notes.
- Keep route files focused on resolved data and shared components. Put repeated entity, stat, effect, tooltip, and relationship markup in shared layers under `src/lib/`.

## Deployment

- Deploy production with `bun run --cwd site deploy:production ../pipeline/artifacts/releases/<snapshot-id>`.
- Make `bun run --cwd site build:fixture` emit ordinary route HTML under `.svelte-kit/cloudflare`, including `/items` and `/items/[slug]`. Do not emit empty SPA shells. Plain `build` assumes an artifact is already staged and does not stage one.
- Authenticate Wrangler with `bunx wrangler login` from `site/`, or provide another valid local context. Do not run a bare global `wrangler` command.
- Keep CI on fixture builds. Do not make CI deploy or require Cloudflare secrets.
