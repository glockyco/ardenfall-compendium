## Why

The 2026-08-02 program survey found that the item index sends a large hydration payload to the browser.

The survey measured the built `items.html` payload at about 488 kilobytes.

The measurement predates the current item routes and their pagination behaviour.

`site/src/routes/items/+page.server.ts` loads every item row through `listItemsOverview()`.

`site/src/routes/items/+page.svelte` passes those rows to the client component.

`site/src/lib/components/items/ItemOverviewFilters.svelte` filters the rows in the browser.

No test pins a performance budget for this route.

The first task must measure the current release before anyone chooses a redesign.

## What Changes

- Measure the current item index payload in a release build.
- Measure the interaction cost that readers experience during filtering and paging.
- Compare server-side filtering, server-side pagination, and client-side alternatives.
- Define a performance budget from current-release evidence.
- Add a test or smoke that enforces the chosen observable budget.

The proposal does not choose a payload or interaction design.

## Capabilities

### New Capabilities

- `item-index-payload`: Measure and govern the item index payload and its reader-facing interaction cost.
