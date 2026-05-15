import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { stageArtifact } from "./stage-artifact.mjs";

const artifactArg = Bun.argv[2];
if (!artifactArg) {
  throw new Error("usage: bun run --cwd site deploy:production <release-artifact-dir>");
}

const artifactDir = resolve(process.cwd(), artifactArg);
const manifestPath = join(artifactDir, "artifact-manifest.json");
await stageArtifact({
  artifactDir,
  targetDir: resolve(import.meta.dirname, "../static"),
  mode: "release",
});
run("bun", ["run", "build:prepared"]);
run("bun", ["run", "smoke:prerender"]);
// Keep this literal command visible for tooling guardrails: wrangler deploy
run("wrangler", ["deploy"]);
run("bun", ["run", "scripts/smoke-production-release.mjs", manifestPath]);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: resolve(import.meta.dirname, ".."),
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit ${result.status}`);
  }
}
