#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = (path) => readFileSync(join(import.meta.dirname, "..", ...path), "utf8");

const overview = source(["src", "routes", "items", "+page.svelte"]);
const detail = source(["src", "routes", "items", "[id]", "+page.svelte"]);
const table = source(["src", "lib", "components", "EntityTable.svelte"]);
const itemIcon = source(["src", "lib", "components", "items", "ItemIcon.svelte"]);
const itemHeader = source(["src", "lib", "components", "items", "ItemHeader.svelte"]);
const tooltipCard = source(["src", "lib", "components", "items", "ItemTooltipCard.svelte"]);
const richTextNode = source(["src", "lib", "components", "content", "RichTextNode.svelte"]);
const readModels = source(["src", "lib", "server", "read-models.ts"]);
const itemReadModel = source(["src", "lib", "server", "entities", "item.ts"]);

const required = [
  [itemReadModel, "displayIconSrc"],
  [itemReadModel, "display_icon_hash"],
  [readModels, "ItemOverviewRow"],
  [readModels, "ItemPresentationRow"],
  [table, "itemNameWithIcon"],
  [table, "sortable?: boolean"],
  [itemIcon, "item-icon"],
  [itemIcon, "aria-hidden={alt.length === 0}"],
  [itemIcon, "{#if src}"],
  [itemIcon, "alt"],
  [itemHeader, "<ItemIcon"],
  [tooltipCard, "<ItemIcon"],
  [detail, "ItemHeader"],
  [detail, "ItemPresentationPanel"],
];

for (const [fileSource, snippet] of required) {
  if (!fileSource.includes(snippet))
    throw new Error(`missing item presentation snippet: ${snippet}`);
}

const overviewIconRequired = ["ItemIcon", "iconSrc(row)", "row[col.field]", "rowHref(row)"];
for (const snippet of overviewIconRequired) {
  if (!table.includes(snippet)) {
    throw new Error(`overview item icon must stay decorative and data-driven: ${snippet}`);
  }
}

if (detail.includes("item_detail_rows") || detail.includes("fields_json")) {
  throw new Error("detail route must not use legacy item_detail_rows fields_json plumbing.");
}
if (overview.includes("{@html") || detail.includes("{@html") || richTextNode.includes("{@html")) {
  throw new Error("item presentation must render rich_text_v1 nodes without raw {@html}.");
}

const titleAttribute = /\stitle=(["'])/;
if (titleAttribute.test(overview) || titleAttribute.test(detail) || titleAttribute.test(table)) {
  throw new Error("Item UI must not use browser title attributes for tooltip content.");
}
