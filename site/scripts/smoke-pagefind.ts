#!/usr/bin/env bun
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

type PagefindModule = {
  options(options: { baseUrl: string }): void;
  search(query: string): Promise<{
    results: Array<{ data(): Promise<{ raw_url: string; meta?: { title?: string } }> }>;
  }>;
};

const outputDir = resolve(import.meta.dirname, "..", ".svelte-kit", "cloudflare");
const pagefindDir = join(outputDir, "pagefind");
const entryPath = join(pagefindDir, "pagefind-entry.json");
const pagefindPath = join(pagefindDir, "pagefind.js");

if (!existsSync(pagefindDir)) throw new Error(`missing Pagefind index: ${pagefindDir}`);
if (!existsSync(entryPath) || !existsSync(pagefindPath)) {
  throw new Error(`Pagefind index is incomplete under ${pagefindDir}`);
}
const entry = JSON.parse(readFileSync(entryPath, "utf8")) as {
  languages?: Record<string, { page_count?: number }>;
};
const pageCount = Object.values(entry.languages ?? {}).reduce(
  (total, language) => total + (language.page_count ?? 0),
  0,
);
if (pageCount === 0) throw new Error("Pagefind index contains no entries");

const probes = ["items", "characters", "spells"].map((section) => findProbe(section));
const server = Bun.serve({
  port: 0,
  fetch(request) {
    const requestPath = decodeURIComponent(new URL(request.url).pathname);
    const path = requestPath === "/" ? "/index.html" : requestPath;
    const filePath = resolve(outputDir, `.${path}`);
    if (!filePath.startsWith(`${outputDir}/`) || !existsSync(filePath)) {
      return new Response("Not found", { status: 404 });
    }
    return new Response(Bun.file(filePath));
  },
});

try {
  const pagefind = (await import(pathToFileURL(pagefindPath).href)) as PagefindModule;
  pagefind.options({ baseUrl: `http://127.0.0.1:${server.port}/pagefind/` });
  for (const probe of probes) {
    const response = await pagefind.search(probe.name);
    const matches = await Promise.all(response.results.map((result) => result.data()));
    if (!matches.some((result) => result.raw_url === probe.url)) {
      throw new Error(`Pagefind index is missing ${probe.name} at ${probe.url}`);
    }
  }
  process.stdout.write(
    `Pagefind smoke passed: ${pageCount} entries for ${probes.map((probe) => probe.name).join(", ")}\n`,
  );
} finally {
  server.stop();
}

function findProbe(section: string): { name: string; url: string } {
  const directory = join(outputDir, section);
  const filename = readdirSync(directory).find((name) => name.endsWith(".html"));
  if (!filename) throw new Error(`missing known ${section} page under ${directory}`);
  const url = `/${section}/${filename}`;
  const html = readFileSync(join(directory, filename), "utf8");
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
  if (!title) throw new Error(`known ${section} page has no title: ${url}`);
  const name = decodeHtml(title.split(" | ")[0] ?? "");
  if (!name) throw new Error(`known ${section} page has no name: ${url}`);
  return { name, url };
}

function decodeHtml(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}
