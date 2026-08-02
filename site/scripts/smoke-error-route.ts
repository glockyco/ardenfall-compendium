#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sourcePath = join(import.meta.dirname, "..", "src", "routes", "+error.svelte");
const source = readFileSync(sourcePath, "utf8");
// Asserts the error route's user-visible affordances. Deliberately checks the
// rendered labels and the fact that recovery is a plain link, not the mechanism
// behind it: the root layout disables CSR, so any recovery control that needs
// hydration silently does nothing on the routes that can actually error.
const requiredSnippets: string[] = [
  "Error {status}",
  "That item doesn't exist",
  "Back to home",
  ">Reload<",
  "href={page.url.pathname + page.url.search}",
];

for (const snippet of requiredSnippets) {
  if (!source.includes(snippet)) {
    throw new Error(`+error.svelte is missing expected error-route text: ${snippet}`);
  }
}
