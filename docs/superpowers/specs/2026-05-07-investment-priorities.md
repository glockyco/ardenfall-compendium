# Ardenfall Archives — Investment Priorities

Date: 2026-05-07
Status: Locked invariant for slice ordering and presentation depth; concrete entity scopes inside map-supporting work remain provisional until real game data proves them out.
Supersedes: nothing. Complements `2026-04-28-ardenfall-archives-design.md` and `2026-04-29-ardenfall-archives-implementation-decisions.md` by establishing how investment is sequenced across slices.

## Purpose

The baseline design and implementation-decisions specs locked architecture and Slice 1 mechanics. Neither document established **where to invest depth**: data breadth, content presentation, map systems, or search infrastructure. This document closes that gap before Slice 2 plans are drafted.

The decisions here are derived from operator-side analytics on the sister project Ancient Kingdoms (AK) and from the Ardenfall game shape (open-world RPG with item economy and explorable map). They will be revisited only against new evidence — site analytics, user feedback, or a structural shift in the game's data model.

## Status legend

- **Locked invariant:** changing this reopens project-wide planning.
- **Locked for current planning horizon:** binding for the next 3–4 slices; revisit when those land.
- **Provisional:** an acceptable initial encoding; expected to evolve as real data proves it out.

## 1. Audience priority order

**Status:** Locked for current planning horizon.

In descending order of expected user demand, derived from AK analytics:

1. **Items.** The dominant traffic driver. Players consult the wiki for itemisation, stats, and acquisition. Item depth pays back the most per unit work.
2. **Maps.** Second-largest demand. Maps subsume "where do I find X" for many entity types — vendors, monsters, gathering nodes, zone connections, points of interest.
3. **Map-supporting entities.** A distant third individually, but collectively important because they make maps _useful_. The concrete set is **game-specific** and is not pre-decided here. For Ardenfall this is expected to include monsters, vendors, zone connections, location markers, and possibly resource nodes; the actual set is determined by what the game's data model exposes and what map markers users want.
4. **Spells, quests, and other content systems.** Real demand exists but is materially lower than items/maps. These slot in after the item/map track is solid enough that adding a new entity type is a one-folder operation.

**Derivation:** AK analytics show items as the dominant page class, maps second, monsters a distant third, with other content systems trailing. Ardenfall is a content-similar Unity Mono open-world RPG; the same shape is the reasonable prior. This will be revalidated against Ardenfall Archives' own analytics once deployment lands.

**What this does not say:**

- This is a _planning_ priority, not a _quality_ priority. Every shipped entity meets the same correctness, accessibility, and presentation bar; lower-priority entities just land later.
- Lower-priority entities (spells, quests) are not deferred indefinitely — they are scheduled after the items/maps depth is strong enough that adding them is cheap.
- Map-supporting entities are not gated on a single game-design decision. They land in dedicated slices as the map system needs them.

## 2. Presentation depth as a first-class concern

**Status:** Locked for current planning horizon.

Content presentation — item tooltips, rich text rendering, inter-entity links, formatted stat blocks — is the **second axis of investment** alongside data breadth. It is not deferred to a single distant "design system depth" slice.

Each major entity gets two slice phases over its lifetime:

1. **Data breadth slice.** Lands the entity, all its variants, and basic detail/overview rendering. Detail pages render data correctly but presentation is utilitarian.
2. **Presentation depth slice.** Lands tooltips, formatted content, inter-entity hyperlinks, design-system primitives specific to the entity's content shape. Runs after the data slice and after assets (if applicable).

For items specifically:

- Slice 1 delivered data breadth for one variant branch.
- A subsequent item-subtype-enrichment slice broadens variant coverage.
- An asset slice puts icons on item pages.
- A dedicated **item presentation depth** slice then invests in tooltips, formatted descriptions, item-to-item linking (set bonuses, recipe ingredients, drop sources where known), and the reusable component primitives those need. This slice runs _before_ the maps track because items are the dominant audience surface.

For maps:

- Locations and the map system land first as a data + visualisation track.
- Map-supporting entities (monsters, vendors, etc.) land as their own slices, each a data slice plus a map-layer integration. Each may also earn a presentation depth follow-up if its detail page warrants one (e.g. monster pages with drop tables that link back to items).

## 3. Foundation hygiene before breadth

**Status:** Locked invariant.

Bugs in the extraction or canonicalisation path compound over breadth. A diagnostic-counting bug on one entity becomes a diagnostic-counting bug on every entity once breadth lands. A walker that re-runs per batch becomes a walker that re-runs per batch on every entity once breadth lands.

**Rule:** known bugs in the foundation are fixed before scope expands. "We will fix it when we get to entity X" is not an acceptable resolution; the only acceptable resolutions are "fixed now" or "documented as a tracked defect with a named-slice owner". Silent deferrals are prohibited.

This does not preclude shipping incomplete coverage — Slice 1 ships only one item variant branch by design. It does preclude shipping with known structural defects in the layers that future work depends on.

## 4. Map-supporting entity scoping

**Status:** Provisional.

Concrete map-supporting entities for Ardenfall are not pre-enumerated here. The map system slice will identify which entity types Ardenfall exposes that benefit from map placement (likely candidates: monsters, vendors, location markers, zone transitions, resource nodes, points of interest), and each gets its own slice in priority order driven by:

- How many map markers the entity contributes (more markers → higher value per slice).
- Whether the entity has independent value off the map (e.g. monsters benefit from detail pages with drop tables; zone transitions probably do not).
- Whether the data is cheap to extract once the variant pattern is in place (the established item-variant template should be reusable for monster types and similar inheritance hierarchies).

**Trigger to firm up:** the map system slice's plan must enumerate the candidate set and propose an order. That order then folds into this document and the roadmap as a non-provisional decision for the next planning horizon.

## 5. Search and design-system depth

**Status:** Locked for current planning horizon.

A separate slice covers FTS5 search, filterable facets, and cross-cutting design system depth (typography scale, layout primitives, link style consistency). This slice runs **after** the items + assets + item-presentation track has stabilised and **after** the map system is in place, because:

- FTS5 indexing makes most sense once the dominant entity type (items) has all its rich content fields populated.
- Filter facets on the items overview page are most valuable once item subtype breadth is in.
- Cross-cutting design tokens benefit from one entity having had presentation depth work, so the abstractions are extracted from a real example rather than speculated.

This slice is later in the order than the AK precedent because Ardenfall Archives bakes the design-system foundation into Slice 1 (Tailwind v4 `@theme inline` tokens + shadcn-svelte primitives). The "depth" slice extends that foundation rather than introducing it.

## 6. What this document does not change

- The architecture from `2026-04-28-ardenfall-archives-design.md` (descriptor-driven uniformity, three-stage pipeline, descriptor-as-registry, generic UI primitives, declarative map layer construction).
- The Slice 1 contract from `2026-04-29-ardenfall-archives-implementation-decisions.md` (item walking skeleton, variant model, site metadata table layout, snapshot manifest shape).
- The tooling pins from `2026-05-03-slice1-tooling-decisions.md`.

It changes only the **ordering** of subsequent slices and adds **presentation depth** as an explicit, repeating slice category rather than a single distant slice.

## Revisit triggers

- Site analytics from a deployed Ardenfall Archives show a materially different audience distribution than AK (e.g. spell traffic exceeding item traffic). Revisit §1.
- The map system slice exposes a structural shape that makes map-supporting entities cheaper to land _en masse_ rather than one-at-a-time. Revisit §4.
- A presentation-depth slice produces design system primitives that are obviously cross-cutting before the search/facets slice runs. Promote those primitives into a shared design slice and re-sequence the search slice accordingly.
