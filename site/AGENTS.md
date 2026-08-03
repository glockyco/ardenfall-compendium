# Site Agent Orientation

SvelteKit static-first site. Generated data is staged as `.data/data.sqlite` plus `static/assets/*.webp`, then read at build time by server-only route loaders so ordinary pages prerender to HTML. The site **never** parses descriptors or schema files at runtime; it reads pipeline-emitted `site_*` tables from SQLite.

## Hard rules

- The site targets WCAG 2.2 Level AA.
- `smoke:accessibility` parses built HTML with hand-written checks. It uses no browser dependency, so CI stays deterministic and can state its limits. It checks duplicate link text, known target dimensions below 24 px, and live-region presence on pages with forms. It cannot inspect client-side updates, focus behavior, or final browser layout.

- Default route architecture is SSR + prerender + no CSR. Generated compendium pages should be static HTML served by Cloudflare Workers Static Assets. Opt into CSR or request-time Worker rendering only with a documented route-level reason.
- `/search` is the one route that needs CSR, because Pagefind reads its index in the browser. It still prerenders, so a reader without JavaScript gets the shell and a message that says search needs a script, not an input that looks broken. The index is built by `build:prepared`, so no deployable build can ship pages without it, and `smoke:pagefind` fails on an absent or empty index.
- The site renders the label it is given. A canonical column holds the raw fact and may be null, a read model holds the reader-facing label, and the site holds neither rule. A site accessor that applies its own unnamed fallback is a second implementation of a pipeline rule, and that drift is how `Name unavailable` appeared beside `Unnamed item`.
- A label never contains an identifier. Short ids and entity ids were once appended to unnamed labels, which showed an identifier for 59 characters, 18 status effects, two factions and 277 item rows, and hid a missing name behind something that looked like data. The one exception is `disambiguateLabels`, which appends a short id only when two entries in one section would otherwise share an accessible name and fail WCAG 2.4.4. That is a collision fix, not a naming fallback, so a listing that can show duplicate labels must pass through it.
- Nothing is hidden. Every row the database holds is listed, including a nameless one, because a compendium that omits what it cannot name misstates the game's contents.
- A relationship target may have no page. Render it as a plain statement, never as a link, and read its page status per row rather than assuming it from the entity type.
- Game text carries TMP markup. A page must never render a raw game string. Read models keep the source column server-side and expose only the translated rich-text document, so pages render typed rich-text nodes.
- Design tokens live in `src/app.css`. Component styling uses token-backed Tailwind utilities or CSS variables; do not hardcode colours, shadows, or one-off spacing systems. Tailwind v4 only generates a colour utility when the matching theme variable exists, and a bare `border` resolves to `currentColor`, so a class naming a token that is not defined silently renders nothing. Pair every `border` with an explicit colour.
- Control boundaries use `border-input-border`, which meets the 3:1 that WCAG 1.4.11 requires. `border-border` is for decorative edges and does not.
- The build database is private. It lives in `.data/`, outside the served root, because anything under `static/` is published. Only `static/assets/` and `static/_release.json` are meant to be public.
- The deployment is files only. `adapter-static` emits no Worker, and `wrangler.toml` sets no `main`, because every route prerenders and the build database is never deployed. A Worker in front of these files could only fail, and it did: its bundle pulled in the server modules that read the database, so it threw on load and answered 500 for any address matching no file. `not_found_handling = "404-page"` serves the prerendered `/404` page instead. A route that ever needs request-time rendering needs this decision revisited, not a quiet exception.
- shadcn-svelte components are owned: edit `src/lib/components/ui/*` freely; do not depend on a specific upstream version. Only the primitives actually in use are kept, so add one when a page needs it rather than vendoring a set in advance.

## Layout

- `src/lib/components/ui/` — vendored shadcn-svelte primitives, kept only where consumed.
- `src/lib/components/<entity>/` — entity-specific presentation components.
- `src/lib/server/` — server-only build-time read models for prerendering.
- `src/routes/` — pages.
- `src/routes/terms/[id]/` renders nothing today and is deliberate, not dead. The pipeline emits `term` entity nodes and rich text links to them when a target resolves. The 2026-08-02 live export produced zero term rows, which is an open question about the emitter rather than proof the game has no terms.

## UI governance

- Route files assemble resolved data and shared components. Repeated entity header, stat, effect, tooltip, or relationship markup belongs in shared component layers under `src/lib/`, not inline in `src/routes/`.
- Before adding a shared UI component, look for one that already does the job. No component catalog exists yet, so read `src/lib/components/` directly. When you add one, give it typed props, token-backed styling and accessibility notes.
- Keep Storybook and visual regression deferred until the component catalog plus static/dev gallery stops being the cheaper maintenance path.

## Deployment

- Production deploys use `bun run --cwd site deploy:production ../pipeline/artifacts/releases/<snapshot-id>`. The command validates `artifact-manifest.json`, stages generated files into `site/static`, builds, smokes, deploys, and runs production release smoke.
- `site/static` is a staging cache. Its generated files must come from exactly one validated artifact and can be deleted/recreated at any time.
- Fixture builds use `bun run --cwd site build:fixture` after `bun run artifact:fixture synthetic fixtures/synthetic/snapshot`; fixture artifacts are valid for tests but must never be accepted by production deploy scripts.
- `bun run --cwd site build` must leave generated HTML under `.svelte-kit/cloudflare` for ordinary routes such as `/items` and `/items/[id]`; these should be static assets, not empty SPA shells.
- Wrangler auth is operator-local. Wrangler is a site dev dependency and is not installed globally, so run `bunx wrangler login` from inside `site/`, or otherwise provide a valid Wrangler auth context, before deploying. A bare `wrangler login` fails with `command not found`.
- CI verifies the fixture build; it does not deploy and does not assume Cloudflare API token/account secrets.
