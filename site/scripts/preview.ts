import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { currentStagePaths, stageKind } from "../stage-paths.mjs";

/**
 * Serves one staged build, the way Cloudflare serves it.
 *
 * `vite preview` reads `.svelte-kit/output`, which every build of either kind overwrites, so a
 * preview started against live data kept running while a fixture build replaced its pages and its
 * rows underneath. This serves the slot's own built files instead: the process either serves that
 * build or fails to start, and a build of the other kind cannot touch it.
 *
 * A miss falls back to the prerendered `404.html`, which is what `not_found_handling` does in
 * production.
 */
const siteDir = resolve(import.meta.dirname, "..");
const stage = currentStagePaths(siteDir);
const portArg = Bun.argv.includes("--port") ? Bun.argv[Bun.argv.indexOf("--port") + 1] : null;
const port = Number(portArg ?? process.env.PORT ?? 4173);

if (!existsSync(stage.outputDir)) {
  throw new Error(
    `no ${stageKind()} build to preview at ${stage.outputDir}. Build it first: SITE_STAGE=${stageKind()} bun run --cwd site build:prepared`,
  );
}

const notFoundPath = join(stage.outputDir, "404.html");

const candidates = (pathname: string): string[] => {
  const clean = pathname.replace(/\/+$/, "");
  const base = join(stage.outputDir, decodeURIComponent(clean));
  return [base, `${base}.html`, join(base, "index.html")];
};

const server = Bun.serve({
  port,
  async fetch(request) {
    const { pathname } = new URL(request.url);
    for (const candidate of candidates(pathname)) {
      if (!candidate.startsWith(stage.outputDir)) break;
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        return new Response(Bun.file(candidate));
      }
    }
    if (existsSync(notFoundPath)) {
      return new Response(Bun.file(notFoundPath), {
        status: 404,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
    return new Response("Not found", { status: 404 });
  },
});

process.stdout.write(
  `Local: http://localhost:${server.port} serving the ${stageKind()} build at ${stage.outputDir}\n`,
);
