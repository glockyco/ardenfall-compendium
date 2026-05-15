#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { join } from "node:path";

const overview = readFileSync(
  join(import.meta.dirname, "..", "src", "routes", "items", "+page.svelte"),
  "utf8",
);
const detail = readFileSync(
  join(import.meta.dirname, "..", "src", "routes", "items", "[id]", "+page.svelte"),
  "utf8",
);
const table = readFileSync(
  join(import.meta.dirname, "..", "src", "lib", "components", "EntityTable.svelte"),
  "utf8",
);
const store = readFileSync(
  join(import.meta.dirname, "..", "src", "lib", "store", "items.ts"),
  "utf8",
);

const required = [
  [store, "displayIconSrc"],
  [store, "display_icon_hash"],
  [table, "itemNameWithIcon"],
  [table, "sortable?: boolean"],
  [detail, "item-icon"],
  [detail, "{#if data.displayIconSrc}"],
  [detail, 'aria-hidden="true"'],
  [detail, 'alt=""'],
];

for (const [source, snippet] of required) {
  if (!source.includes(snippet)) throw new Error(`missing item icon snippet: ${snippet}`);
}

const overviewIconRequired = ['aria-hidden="true"', 'alt=""', "iconSrc(row)"];
for (const snippet of overviewIconRequired) {
  if (!table.includes(snippet)) {
    throw new Error(`overview item icon must stay decorative and data-driven: ${snippet}`);
  }
}

const detailWrapperIndex = detail.indexOf('class="item-icon');
const detailImageGuardIndex = detail.indexOf("{#if data.displayIconSrc}");
if (
  detailWrapperIndex < 0 ||
  detailImageGuardIndex < 0 ||
  detailWrapperIndex > detailImageGuardIndex
) {
  throw new Error("detail placeholder wrapper must exist outside the displayIconSrc branch.");
}
if (!detail.slice(detailWrapperIndex, detailImageGuardIndex).includes('aria-hidden="true"')) {
  throw new Error("detail placeholder wrapper must remain decorative.");
}

if (!table.includes("row[col.field]") || !table.includes("rowHref(row)")) {
  throw new Error("EntityTable must keep the row field as linked accessible text.");
}
if (table.includes("$state") || table.includes("onclick=") || table.includes("toggleSort")) {
  throw new Error(
    "EntityTable must remain static by default; interactive sorting belongs in a CSR opt-in route.",
  );
}
if (!table.includes("rowHref(row)")) {
  throw new Error("EntityTable must keep static linked row text.");
}
const forbidden = ["Tooltip", "popover", "hovercard", "secondaryIcon"];
for (const snippet of forbidden) {
  if (overview.includes(snippet) || detail.includes(snippet) || table.includes(snippet)) {
    throw new Error(`Slice 3 item UI must not include tooltip/overlay snippet: ${snippet}`);
  }
}

const titleAttribute = /\stitle=(["'])/;
if (titleAttribute.test(overview) || titleAttribute.test(detail) || titleAttribute.test(table)) {
  throw new Error("Slice 3 item UI must not include title attributes.");
}
