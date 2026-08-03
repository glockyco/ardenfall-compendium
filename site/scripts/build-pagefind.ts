#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const siteDir = resolve(import.meta.dirname, "..");
const outputDir = join(siteDir, ".svelte-kit", "cloudflare");
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

const indexFiles = listFiles(pagefindDir);
if (indexFiles.length === 0) {
  throw new Error(`Pagefind produced no files under ${pagefindDir}`);
}
const indexBytes = indexFiles.reduce((total, path) => total + statSync(path).size, 0);
const deployFiles = listFiles(outputDir);

process.stdout.write(
  `Pagefind index: ${indexFiles.length} files, ${indexBytes} bytes at ${pagefindDir}\n`,
);
process.stdout.write(`Deploy assets: ${deployFiles.length} files (20,000 file limit)\n`);
if (deployFiles.length > 20_000) {
  throw new Error(
    `deploy output contains ${deployFiles.length} files, more than the 20,000 file limit`,
  );
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
