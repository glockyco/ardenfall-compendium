---
title: Canonical Table Contract
type: spec
status: implemented
created: 2026-08-03
parent: 2026-04-29-ardenfall-compendium-roadmap
superseded_by:
archived: 2026-08-03
---

# Canonical Table Contract

Close the last place where the descriptor is authoritative in principle and advisory in practice. [`2026-08-03-descriptor-field-contract`](archive/2026-08-03-descriptor-field-contract.md) made the snapshot honour the descriptor. This makes the database honour it.

## The gap

Only `item` generates its DDL from a descriptor. The other eight entities have hand-written SQL constants, so for eight of nine entities the canonical table's real shape is a string that sits beside the descriptor and agrees with it by convention.

Measured against the 2026-08-03 export, a declared field reaches its table in four different ways and only one of them is stated anywhere.

| relationship | example | declared? |
| --- | --- | --- |
| field becomes a column of the same name | `enabled` to `locations.enabled` | yes, by convention |
| field becomes a **renamed** column | `mapRef` to `locations.map_ref_json`, `name` to `characters.character_name` | no |
| field is **projected** into another table | `volumes` to `location_volumes` | yes, since the field contract slice |
| field is **dropped** | `gameLocationId`, `displayOnEnterVolume`, `isAccessible` | no |

The last row is the one that costs something today. Those three fields are extracted by the mod, shipped in 48, 48 and 33 rows, and read by nothing. They pay for mod code, snapshot bytes and a hash, and reach no table and no page.

The second row is the one that will cost something later. Nothing connects `mapRef` to `map_ref_json` except the canonicaliser that happens to write both, so the descriptor and the table can drift apart in either direction without a build noticing.

## Why not generate the DDL

The obvious response is to generate all nine tables from descriptors, and it is the wrong one. The hand-written tables legitimately carry things a descriptor should not express: JSON-serialised columns, deliberately renamed columns, `NOT NULL` constraints that encode canonicaliser guarantees rather than extraction guarantees, and side tables such as `location_volumes` and `placements` that hold a projection rather than a row.

Forcing those through generation turns the descriptor into a schema DSL, which is a much larger surface than the problem justifies. The `storage` and `destination` fields added in the previous slice already demonstrate the trap in miniature: they were introduced to describe projection and immediately got used for renaming too, because there was nowhere else to put it.

## Design

**Separate the two ideas that `storage: projected` currently conflates.** A field either lands in this entity's canonical table, possibly under another name, or it is consumed to build something else, or it is deliberately not stored. Three distinct facts, three distinct declarations:

- `column`, optionally naming the column when it differs from the field.
- `projected`, naming the table it contributes to. Reserved for a field that genuinely produces rows elsewhere, such as `volumes`.
- `unstored`, with a reason. A field extracted for a purpose other than storage, or not yet consumed, said out loud rather than discovered by grep.

Note a field can be both stored and projected, `portal.position` is written to `portals.source_position_json` and also produces a `map_points` row, so the declaration has to allow that rather than forcing a single choice.

**Assert the relationship at build time.** After the DDL runs and before canonicalisation, check both directions: every `column` field names a column that exists, and every column in an entity's canonical table is explained by exactly one declared field. Fail naming the entity, the field or column, and which direction failed.

That second direction is the valuable half. It catches a column added to hand-written SQL that no descriptor mentions, which is how the shape drifts today.

**Decide the three unstored fields on their merits.** `isAccessible` was examined in the semantics audit, which found `PortalRecord.isAccessible` defaults to true and concluded we should not infer accessibility from it. That is a reason to declare it `unstored`, not a reason to keep extracting it silently. `gameLocationId` and `displayOnEnterVolume` need the same judgement: either something wants them, in which case store them, or nothing does, in which case stop extracting them.

## Acceptance

- Every declared `column` field names a real column, and every column in the eight hand-written canonical tables is explained by exactly one declared field.
- Renaming a column in hand-written SQL without updating the descriptor fails the build. There is a test that proves it.
- The `storage: projected` entries added by the previous slice are re-examined, and the four that are really renamed columns say so instead.
- `gameLocationId`, `displayOnEnterVolume` and `isAccessible` are each resolved, either stored or no longer extracted, with the reason recorded.
- No column changes and no page changes. A live export produces byte-identical diagnostics, 417 columns, and the same 1,794 pages.

## Resolved

**The assertion lives inside `emit-sqlite`**, not a separate stage. That stage executes each entity's DDL and calls its canonicaliser in the same loop, so the table exists nowhere else. The check runs between the two, per entity, which also makes a failure name the entity for free.

**`item` keeps generating**, with a comment saying so. Generation is strictly stronger than assertion where it applies, so the two coexisting is deliberate rather than historical.

**Every entity declares `canonicalTable`, and it is required.** Variant descriptors already declared one, so entities lacking it was the inconsistency. Optional with a naming-convention fallback would have reintroduced the silent inference this change exists to remove.

## Known limit

The reverse check covers each entity's declared canonical table and not the side tables created by the same DDL constant, such as `location_volumes` and `placements`. Those hold projections rather than entity rows, so their columns are the canonicaliser's business rather than the field list's. Nothing currently asserts their shape.
