---
title: "Repository Health Audit — Open Findings"
type: audit
status: active
created: 2026-08-02
parent: 2026-04-29-ardenfall-compendium-roadmap
superseded_by:
archived:
---

# Repository Health Audit — Open Findings

A repo-wide audit on 2026-08-02 covered planning coherence, all four subsystems, schemas, tooling, CI, tests, and dependency currency. Most findings are remediated; what follows is what remains open, verified against the tree.

Severity: **major** — real defect or invariant violation with a plausible failure path; **minor** — worth fixing, no current failure path.

---

## Open

Nothing from the original audit remains open. `M10` (four hand-maintained entity-id lists) and `N5` (test gaps in rich-text parsing, artifact tampering, and a weak table assertion) are resolved, and the temp-directory race in the site tests is gone.

Two things were found while closing them and are recorded here because they are latent rather than fixed:

### The rich-text parser treats comparison text as a tag

`pipeline/src/rich-text/rich-text-v1.ts:52` matches `<...>` loosely enough that ordinary prose containing a comparison, such as `5 < 6 & 7 > 3`, is consumed as an unsupported tag and emits `unsupportedRichTextTag` at line 144. The text node survives unchanged, so nothing renders wrong. The cost is a false diagnostic, and a diagnostic that cries wolf is worse than none.

Not fixed, because the live export produces zero rich-text diagnostics of any kind — no authored description in the current build trips it. Tightening the pattern to require a plausible tag name is the fix if a future build makes it fire. The behaviour is pinned by a test, so it cannot change silently.

### Crossed-tag recovery is lossy

`<b><i>x</b></i>` drops the outer formatting and leaves the unmatched `</b>` as literal visible text. If real content ever contains crossed tags, that ships as garbage on the page rather than as a formatting approximation. Same reason for not acting: the current corpus contains none, and the behaviour is now pinned by a test that documents it plainly rather than dressing it up.

---

## Fixed since the audit, worth knowing

- **Standalone scripts were type-checked by nothing.** `site/scripts/` and the root `scripts/` directory were plain JavaScript, and neither `bun run typecheck` nor `bun run --cwd site check` covered them. That included the artifact tamper gate and the production deploy driver. They are TypeScript now and the root project includes them, verified by injecting an error and watching the gate fail.
- **Portal connectivity wrote unread relationship sections.** Thirty rows per export that no reader consumed. Removed.

## Constraints discovered, worth not rediscovering

- **TypeScript 7 is not adoptable yet.** It went GA on 2026-07-08, but `svelte-check` caps its `typescript` peer at `^5 || ^6` and `typescript-eslint` caps below `6.1.0`. Adopting 7 means running the type checker and linter against a version neither supports. Recheck when both publish support. This is recorded in `AGENTS.md` so it is not retried blind.
- **The site build runs under Node, not Bun.** `vite build` spawns Node, so SvelteKit's prerender loads server chunks there. The `better-sqlite3` branch in `site/src/lib/server/db.ts` is therefore load-bearing despite the repo being Bun-first, and removing it breaks the build. Verify against the prerender, not against `bun test`, before touching that adapter.
- **One mod branch is untestable outside Unity.** In `ItemExtractor`, the path where a lookup returns null for a non-null asset cannot be reached in tests: an uninitialized `ItemData` is already null under Unity's overloaded operator, so the extractor takes the missing-asset branch first, and giving doubles distinct instance ids throws `SecurityException`. Noted in the test file.
