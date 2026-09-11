#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { currentStagePaths } from "../stage-paths.mjs";

const siteDir = resolve(import.meta.dirname, "..");
const outputDir = currentStagePaths(siteDir).outputDir;
const pagefindDir = join(outputDir, "pagefind");

if (!existsSync(outputDir)) {
  throw new Error(`missing prerender output: ${outputDir}`);
}
rmSync(pagefindDir, { recursive: true, force: true });

const result = spawnSync(
  join(siteDir, "node_modules", ".bin", "pagefind"),
  [
    "--site",
    outputDir,
    "--output-subdir",
    "pagefind",
    "--exclude-selectors",
    "nav,footer,[data-pagefind-ignore]",
  ],
  { cwd: siteDir, stdio: "inherit" },
);
if (result.status !== 0) {
  throw new Error(`pagefind failed with exit ${result.status}`);
}

const prunedDataFiles = pruneStaticPageData(outputDir);

const indexFiles = listFiles(pagefindDir);
if (indexFiles.length === 0) {
  throw new Error(`Pagefind produced no files under ${pagefindDir}`);
}
const indexBytes = indexFiles.reduce((total, path) => total + statSync(path).size, 0);
const deployFiles = listFiles(outputDir);

process.stdout.write(
  `Pagefind index: ${indexFiles.length} files, ${indexBytes} bytes at ${pagefindDir}\n`,
);
process.stdout.write(`Pruned page data: ${prunedDataFiles} files of pages that never hydrate\n`);
process.stdout.write(`Deploy assets: ${deployFiles.length} files (20,000 file limit)\n`);
if (deployFiles.length > 20_000) {
  throw new Error(
    `deploy output contains ${deployFiles.length} files, more than the 20,000 file limit`,
  );
}

/**
 * Removes the `__data.json` beside every page that ships no client runtime.
 *
 * SvelteKit writes a data file for each prerendered page with a server `load`, whether or
 * not a client could ever ask for it. Every link on this site is a document load, so the
 * only fetches of a data file come from a hydrated route syncing its own URL. A page that
 * did not hydrate carries no `__sveltekit_` start script, and its data file is dead weight
 * against the deploy file limit.
 */
function pruneStaticPageData(directory: string): number {
  let pruned = 0;
  for (const dataPath of listFiles(directory)) {
    if (!dataPath.endsWith("/__data.json")) continue;
    const pageDir = dirname(dataPath);
    const pagePath = pageDir === directory ? join(directory, "index.html") : `${pageDir}.html`;
    if (!existsSync(pagePath)) {
      throw new Error(`page data ${dataPath} has no page beside it at ${pagePath}`);
    }
    if (readFileSync(pagePath, "utf8").includes("__sveltekit_")) continue;
    rmSync(dataPath);
    if (readdirSync(pageDir).length === 0) rmSync(pageDir, { recursive: true });
    pruned += 1;
  }
  return pruned;
}

function listFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}
