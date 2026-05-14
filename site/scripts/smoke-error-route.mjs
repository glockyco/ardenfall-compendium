#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sourcePath = join(import.meta.dirname, "..", "src", "routes", "+error.svelte");
const source = readFileSync(sourcePath, "utf8");
const requiredSnippets = ["Error {page.status}", "That item doesn't exist", "Back to home", "window.location.reload"];

for (const snippet of requiredSnippets) {
  if (!source.includes(snippet)) {
    throw new Error(`+error.svelte is missing expected error-route text: ${snippet}`);
  }
}
