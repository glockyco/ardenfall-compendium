## Context

The item index server route calls `listItemsOverview()` at `site/src/routes/items/+page.server.ts:15-16` and passes every row to the client. `ItemOverviewRow` contains identity, name, weight, value, variant, icon presentation and route data at `site/src/lib/server/entities/item.ts:67-79`. The query is at `item.ts:296-304`. `ItemOverviewFilters.svelte` filters all rows in the browser and paginates only the displayed slice.

The proposal's earlier payload figure predates the current item routes. No current-release budget exists. The first implementation step must measure the built route and its hydrated payload before choosing a target.

## Goals / Non-Goals

**Goals:**

- Record a reproducible current-release measurement for item-index payload and filtering cost.
- Ensure the index sends only data needed by its rendered columns and controls.
- Enforce a recorded payload budget during the build.
- Preserve the reader-visible filtering and paging contract while reducing unneeded transfer.

**Non-Goals:**

- Optimising item detail pages or unrelated hydration payloads.
- Choosing server-side filtering or pagination before current evidence exists.
- Replacing the item overview read model with a second item source of truth.
- Inventing a byte target before measuring the current release.

## Decisions

### 1. Measure the current release before selecting a budget

The measurement will build the current release, inspect the generated item index, record HTML and hydration payload sizes, and exercise filtering and paging in a browser. It will record the release identity, row count, columns, viewport and measurement method.

The open question is which payload boundary becomes authoritative. Alternatives are the full HTML response, the serialized hydration data, or the combined transfer needed for first render. The selected boundary must be stable across builds.

### 2. Keep the page contract tied to the overview read model

The index will request only fields that its columns, filter controls, table renderers and routes consume. Any redesign will adapt `listItemsOverview()` or its server query rather than duplicate item data in the page layer.

The open question is whether filtering and pagination remain client-side or move to server requests. Client filtering preserves instant transitions but transfers all rows. Server filtering reduces transfer but adds navigation and request latency. The measurement will decide.

### 3. Store the measured budget as release evidence

After the baseline, the change will record the selected budget with its measurement evidence. A build check will fail when the chosen payload boundary exceeds that recorded value.

The budget value is intentionally unspecified in this design. The measurement task must produce it before implementation sets the gate.

### 4. Test behaviour at the hydrated reader surface

The check will inspect the built route through the same browser surface readers use. It will assert that required columns render, filters change the visible rows, paging remains correct and the measured payload stays within budget.

## Risks / Trade-offs

- A budget based on one row count can hide growth in row count. The evidence will record row count, and the gate will report both payload and row count.
- Browser hydration can differ from prerendered HTML. The measurement and smoke will exercise hydration, not source text.
- Server-side filtering can improve payload size while increasing interaction latency. The browser measurement must capture both costs before selecting it.
- Asset URLs and icon data can dominate transfer without appearing in row objects. The payload boundary will include the bytes readers actually receive.
