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

Nothing from the *original* audit remains open. `M10` (four hand-maintained entity-id lists) and `N5` (test gaps in rich-text parsing, artifact tampering, and a weak table assertion) are resolved, and the temp-directory race in the site tests is gone.

Two things were found while closing them and are recorded here because they are latent rather than fixed:

### The rich-text parser treats comparison text as a tag

`pipeline/src/rich-text/rich-text-v1.ts:52` matches `<...>` loosely enough that ordinary prose containing a comparison, such as `5 < 6 & 7 > 3`, is consumed as an unsupported tag and emits `unsupportedRichTextTag` at line 144. The text node survives unchanged, so nothing renders wrong. The cost is a false diagnostic, and a diagnostic that cries wolf is worse than none.

Not fixed, because the live export produces zero rich-text diagnostics of any kind — no authored description in the current build trips it. Tightening the pattern to require a plausible tag name is the fix if a future build makes it fire. The behaviour is pinned by a test, so it cannot change silently.

### Crossed-tag recovery is lossy

`<b><i>x</b></i>` drops the outer formatting and leaves the unmatched `</b>` as literal visible text. If real content ever contains crossed tags, that ships as garbage on the page rather than as a formatting approximation. Same reason for not acting: the current corpus contains none, and the behaviour is now pinned by a test that documents it plainly rather than dressing it up.

---

## Semantics audit, 2026-08-02

A separate sweep asked a different question of every field we publish: not what type it is, but **where the game reads it and what it does with it**. Five parallel audits against the decompiled source. The premise is that a field with the right type and the wrong meaning is worse than a missing one, because it reads as authoritative.

Four reader-facing misrepresentations were confirmed and fixed. Recorded here because the *class* of error matters more than the instances.

- **A spell's stat was published as its "school".** It is the skill that scales the spell and doubles as the item's minimum stat. It looked like a school only because every spell in this build happens to reference a magic skill.
- **Item pages asserted equip "Requirements".** `CanEquip` returns true unconditionally. Falling short of the stat applies penalty multipliers to output.
- **Category pages published the game's inventory table column configuration** as catalogue knowledge.
- **The map filtered on a fast-travel flag with no runtime consumer.** Real availability comes from a fast-travel set we do not extract.

Three values were qualified rather than removed, since each is genuinely useful for comparison and misleading only when bare: base damage, base value, and base mana cost are all first terms in runtime formulas.

### Still open from that audit

**~~The map projection does not match the game's.~~ Closed on 2026-08-15: it matches, and the claim of a mismatch was wrong about our own pipeline.**

The three stages agree, each read rather than assumed:

- The game maps `((x - cx) / worldMapDivision.x, (z - cz) / worldMapDivision.y)` with no sign flip (`Ardenfall/UI/WorldMapUI.cs:410-416`).
- We map `{ x: point.x, y: point.z, elevation: point.y }`, also with no flip (`pipeline/src/entities/location/canonicaliser.ts:188`, and `mapMaxY = sourceMaxZ` for volumes). The earlier claim that we map `x, -z` was not true of the code.
- The site renders with `new OrthographicView({ id: "map", flipY: false })` (`site/src/lib/components/map/MapCanvas.svelte:189`), so screen `y` increases with world `z`, which is the same orientation the game's UI space gives it.

So no mirroring exists, and the difference in scale is absorbed by fitting bounds.

The portal-anchor mechanism is real but is not this defect. `WorldMapUI` builds door-to-record anchor mappings for the current cell and uses them in `GetPlayerMapPosition` (`Ardenfall/UI/WorldMapUI.cs:176-210`), which projects an interior position onto the overworld map so the player icon has somewhere to sit. We model `interior` as its own map with its own bounds instead, which is a presentation choice rather than a missing feature. Tile capture may revisit it if interiors are ever drawn on the overworld plate.

**Debug-only locations can be revealed in production.** The game gates them on `Debug.isDebugBuild` and additionally on discovery. Our client offers a toggle that reveals them in any build, and shows undiscovered locations unconditionally. Showing undiscovered content is defensible for a compendium and arguably the point, but it should be a decision rather than an accident, and debug-only content is a different question.

**Item tags are understated.** They are not merely descriptive: they feed item effect tooltips, match potion recipe ingredients, and `FactionItemTag` modifiers alter faction relationships from equipped gear. The extractor emits only name and description, dropping the only structured subtype payload the game has.

**`sk_unarmed` is confirmed vestigial.** No `CoreStats` entry, no runtime skill key, no consumer, and `HandItem.CalculateDamage` returns zero. It ships as authored content with a diagnostic. Whether an unreachable asset should hold a public route is still open.

## Fixed since the audit, worth knowing

- **Standalone scripts were type-checked by nothing.** `site/scripts/` and the root `scripts/` directory were plain JavaScript, and neither `bun run typecheck` nor `bun run --cwd site check` covered them. That included the artifact tamper gate and the production deploy driver. They are TypeScript now and the root project includes them, verified by injecting an error and watching the gate fail.
- **Portal connectivity wrote unread relationship sections.** Thirty rows per export that no reader consumed. Removed.

## Constraints discovered, worth not rediscovering

- **TypeScript 7 is not adoptable yet.** It went GA on 2026-07-08, but `svelte-check` caps its `typescript` peer at `^5 || ^6` and `typescript-eslint` caps below `6.1.0`. Adopting 7 means running the type checker and linter against a version neither supports. Recheck when both publish support. This is recorded in `AGENTS.md` so it is not retried blind.
- **The site build runs under Node, not Bun.** `vite build` spawns Node, so SvelteKit's prerender loads server chunks there. The `better-sqlite3` branch in `site/src/lib/server/db.ts` is therefore load-bearing despite the repo being Bun-first, and removing it breaks the build. Verify against the prerender, not against `bun test`, before touching that adapter.
- **One mod branch is untestable outside Unity.** In `ItemExtractor`, the path where a lookup returns null for a non-null asset cannot be reached in tests: an uninitialized `ItemData` is already null under Unity's overloaded operator, so the extractor takes the missing-asset branch first, and giving doubles distinct instance ids throws `SecurityException`. Noted in the test file.
