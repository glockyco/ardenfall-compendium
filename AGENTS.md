# Repo Agent Orientation

This repository is the static compendium for the game Ardenfall. Its design is captured in `docs/superpowers/specs/`. Read those before changing anything; they document non-obvious invariants this codebase enforces by design.

## Where to look first

- Design baseline: `docs/superpowers/specs/2026-04-28-ardenfall-compendium-design.md`
- Implementation decisions (authoritative where the baseline differs): `docs/superpowers/specs/2026-04-29-ardenfall-compendium-implementation-decisions.md`
- Slice-1 tooling pins: `docs/superpowers/specs/2026-05-03-slice1-tooling-decisions.md`
- Living roadmap: `docs/superpowers/roadmap.md`
- Active plan, when one exists: `docs/superpowers/plans/<latest>.md`

## Subsystem entry points

- `mod/AGENTS.md` — BepInEx walker, DTOs, snapshot writer.
- `pipeline/AGENTS.md` — descriptor loader, stage orchestrator, canonicaliser, site-metadata emitter.
- `site/AGENTS.md` — SvelteKit pages, store accessors, design tokens, deck.gl map (later).

## Non-negotiable invariants

- The descriptor at `entities/<id>/entity.json` is the only cross-subsystem source of truth for entity shape. Do not duplicate it in TS, SQL, or C#.
- Filesystem is the registry. Do not maintain manual indexes, enums, or unions of entity ids.
- The site reads pipeline-emitted SQLite metadata only. It does not parse descriptors directly.
- No raw Unity / Odin / game-object JSON in snapshots. The mod walks live runtime graphs and emits explicit DTOs.
- Public presentation and link contracts are generated pipeline data. The site renders typed read models, rich-text nodes, and relationship edges; it does not render raw TMP/HTML or infer durable cross-entity links in route code.
- Public contract replacements are clean cutovers. When a new read model, route contract, or shared UI primitive replaces an old one, remove the old public fallback/plumbing in the same slice; use private `_debug_*` views or diagnostics for temporary inspection.
- Pre-commit runs Prettier, ESLint, and `dotnet format` via lefthook. Do not bypass with `--no-verify` for routine work.
- Generated deploy artifacts are identified by `artifact-manifest.json`. Production deploys consume only release artifacts under `pipeline/artifacts/releases/*`; fixture artifacts under `pipeline/artifacts/fixtures/*` are never deployable.
- `site/static` is a staging cache populated from a validated artifact. Do not treat it as source-of-truth and do not manually edit generated files there.

If you find this document outdated, update it in the same commit as the change that outdates it.
