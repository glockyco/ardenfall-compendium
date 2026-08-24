## Context

The repository already uses `AGENTS.md` files as subsystem contracts. The root guide assigns descriptor and read-model ownership to the pipeline, typed rendering and component ownership to the site, and extraction ownership to the mod.

The guides state the rules today, but they do not show the recurring failure and its corrected form together. A maintainer can therefore follow a plausible local pattern that violates a shared contract.

`tooling.test.ts` already checks guidance integrity, including gate alignment, skill references, and duplicated requirement sentences. The new examples extend that existing guidance check instead of creating a second integrity suite.

## Goals

- Put one wrong and one right example beside each named subsystem decision.
- Tie every right example to an owning source file and an observable result.
- Keep examples short enough to stay useful during code review.
- Keep the guides aligned with the current pipeline, component, and relationship contracts.

## Non-Goals

- Rewriting the existing subsystem orientation sections.
- Adding a new documentation framework or example site.
- Testing prose style as a substitute for checking the example outcome.
- Duplicating entity fields or implementation details in the guides.

## Decisions

### 1. Generated read-model cutovers belong to pipeline and site guidance

The pipeline owns the generated read model and its registry entry. The site consumes the emitted tables through server-only loaders. The paired example shows the wrong path that keeps an obsolete public read model and the right path that removes it and consumes the current producer.

The example cites `pipeline/src/entities/registry.ts` and `site/src/lib/server/read-models.ts`, so a maintainer can inspect the contract rather than trust a sketch.

### 2. Rich text belongs to the site presentation contract

The pipeline translates source text into a typed document. The site renders that document through the shared content component. The wrong example uses raw markup. The right example passes the typed document to `RichText` and leaves parsing outside the route.

The example cites `site/src/lib/components/content/RichText.svelte`. It also names the read-model boundary so a future component does not reintroduce raw text.

### 3. Relationship labels belong to the graph producer

The pipeline resolves target labels, routes, and page status in relationship data. The site renders those supplied values and does not compose a durable relationship in a route. The wrong example builds a label from a route parameter. The right example consumes `EntityLink` data.

The example cites `pipeline/src/relationships/relationship-graph.ts` and `site/src/lib/components/relationships/EntityLink.svelte`.

### 4. New components enter through the site component contract

A new site component needs a typed prop boundary, token-backed styling, an accessibility note, and a real route consumer. The wrong example repeats markup in a route or adds an untyped shortcut. The right example adds the smallest shared component under the owned component tree and consumes it from a route.

The example cites one component file and one route file. The cited files must exist when the guide change lands.

### 5. Automate objective integrity, review meaning

The existing guidance integrity test verifies that each named pair exists and that every cited repository path resolves. It does not infer semantic correctness from prose keywords or copied source fragments. Such checks are easy to satisfy while preserving a wrong example, and they couple guidance wording to the test.

Review each pair against the cited owner and observable result. Runtime tests remain the authority for pipeline and site behavior.

### 6. Keep examples smaller than their sources

Each pair is a minimal pseudo-diff or before/after fragment. It names the violated invariant, the owner, and the observable result. It does not copy complete functions, schemas, or field inventories that can drift independently. This is progressive disclosure: the guide teaches the decision and the citation supplies implementation detail.

## Risks and Trade-offs

- **Examples can become stale.** Citations point to real files, and the existing guidance test can fail when an example loses its required contract markers.
- **A wrong example can be copied.** Each wrong version is labelled as a failure and states the violated rule beside the corrected version.
- **Several patterns cross subsystem boundaries.** The owner file and consumer file are both cited, so ownership stays visible.
- **Guides can grow too long.** Each pair covers one decision and points to source files instead of reproducing full implementations.
