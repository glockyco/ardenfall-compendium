import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import validateManifest from "../../dist/validate-manifest.mjs";
import validateSnapshot from "../../dist/validate-snapshot.mjs";
import type { SnapshotEnvelope, SnapshotManifest, Stage } from "../types.ts";

export interface LoadSnapshotOutput {
  manifest: SnapshotManifest;
  envelopes: Record<string, SnapshotEnvelope>;
}

export const loadSnapshot: Stage<unknown, LoadSnapshotOutput> = {
  id: "load-snapshot",
  inputs: [],
  run: (_inputs, ctx) => {
    const dir = ctx.snapshotDir;
    const manifestPath = join(dir, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as SnapshotManifest;
    if (!validateManifest(manifest)) {
      const detail = (validateManifest.errors ?? [])
        .map((e) => `${manifestPath}#${e.instancePath} — ${e.message}`)
        .join("\n");
      throw new Error(`invalid snapshot manifest at ${manifestPath}:\n${detail}`);
    }

    const envelopes: Record<string, SnapshotEnvelope> = {};
    for (const fileName of readdirSync(dir)) {
      if (fileName === "manifest.json") continue;
      if (!fileName.endsWith(".json")) continue;
      const path = join(dir, fileName);
      const env = JSON.parse(readFileSync(path, "utf8")) as SnapshotEnvelope;
      if (!validateSnapshot(env)) {
        const detail = (validateSnapshot.errors ?? [])
          .map((e) => `${path}#${e.instancePath} — ${e.message}`)
          .join("\n");
        throw new Error(`invalid snapshot envelope at ${path}:\n${detail}`);
      }
      envelopes[env.entityId] = env;
    }
    return { manifest, envelopes };
  },
};
