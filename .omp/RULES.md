# Sticky repository rules

- Never edit generated or deployed output by hand. Change its source and regenerate it. Treat `site/static` and `pipeline/dist` as staging caches, not sources. A deploy artifact is identified by its `artifact-manifest.json`. Production deploys consume only release artifacts under `pipeline/artifacts/releases/*`. Fixture artifacts are never deployable. (Source: `docs/plans/2026-06-04-compendium-data-architecture.md` §6 and §8.)
- Use `entities/<id>/entity.json` as the only cross-subsystem source of truth for entity shape. Do not duplicate its fields in TypeScript, SQL, or C#. (Source: `docs/plans/2026-06-04-compendium-data-architecture.md` §3 and §8.)
- Fail fast when source-of-truth data is missing. Emit diagnostics or fail the slice. Add recovery only for an explicit, continuously verified contract. (Source: `docs/plans/2026-06-04-compendium-data-architecture.md` §6.)
- Never bypass the pre-commit hooks. Commit without `--no-verify`. (Source: `docs/plans/archive/2026-05-03-slice1-tooling-decisions.md` §7 "Pre-commit hooks".)
