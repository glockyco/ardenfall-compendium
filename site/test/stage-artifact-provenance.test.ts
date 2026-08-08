import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { describe, expect, it } from "bun:test";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { stageArtifact, type ArtifactManifest } from "../scripts/stage-artifact";

const fixtureArtifact = resolve(import.meta.dir, "../../pipeline/artifacts/fixtures/synthetic");

function copyArtifact(): { artifactDir: string; targetDir: string; root: string } {
  const root = mkdtempSync(join(tmpdir(), "ardenfall-stage-artifact-"));
  const artifactDir = join(root, "artifact");
  cpSync(fixtureArtifact, artifactDir, { recursive: true });
  return { artifactDir, targetDir: join(root, "static"), root };
}

function setDirtyProvenance(artifactDir: string): void {
  const manifestPath = join(artifactDir, "artifact-manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ArtifactManifest;
  manifest.git.dirty = true;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function setReleaseProvenance(artifactDir: string, dirty: boolean): ArtifactManifest {
  const manifestPath = join(artifactDir, "artifact-manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ArtifactManifest;
  const source = { ...manifest.source };
  delete source.fixtureName;
  manifest.artifactKind = "release";
  manifest.source = { ...source, kind: "live-game-export" };
  manifest.git.dirty = dirty;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const db = new Database(join(artifactDir, "data.sqlite"));
  try {
    db.query("UPDATE artifact_metadata SET value = ? WHERE key = ?").run("release", "artifactKind");
    db.query("UPDATE artifact_metadata SET value = ? WHERE key = ?").run(
      "live-game-export",
      "sourceKind",
    );
  } finally {
    db.close();
  }

  // Rewriting the database changed its bytes, and stageArtifact verifies every
  // hashed file against the manifest. Restate the hash so the test exercises the
  // provenance guard rather than tripping the tamper check first.
  const rewritten = readFileSync(join(artifactDir, "data.sqlite"));
  manifest.outputs.sqlite.sha256 = createHash("sha256").update(rewritten).digest("hex");
  manifest.outputs.sqlite.bytes = rewritten.byteLength;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

function cleanup(root: string): void {
  rmSync(root, { recursive: true, force: true });
}

describe("stage artifact provenance", () => {
  it("refuses a dirty release and identifies the recorded commit", async () => {
    const { artifactDir, targetDir, root } = copyArtifact();
    const manifest = setReleaseProvenance(artifactDir, true);
    try {
      await expect(stageArtifact({ artifactDir, targetDir, mode: "release" })).rejects.toThrow(
        `cannot stage release artifact: recorded commit ${manifest.git.commit}, but the tree was dirty. Build from a clean tree and stage the new artifact again.`,
      );
      expect(existsSync(targetDir)).toBe(false);
    } finally {
      cleanup(root);
    }
  });

  it("stages a clean release", async () => {
    const { artifactDir, targetDir, root } = copyArtifact();
    setReleaseProvenance(artifactDir, false);
    try {
      const result = await stageArtifact({ artifactDir, targetDir, mode: "release" });
      expect(result.manifest.git.dirty).toBe(false);
      expect(readFileSync(join(targetDir, "_release.json"), "utf8")).toContain('"dirty": false');
    } finally {
      cleanup(root);
    }
  });

  it("still stages a dirty fixture artifact", async () => {
    const { artifactDir, targetDir, root } = copyArtifact();
    setDirtyProvenance(artifactDir);
    try {
      const result = await stageArtifact({ artifactDir, targetDir, mode: "fixture" });
      expect(result.manifest.artifactKind).toBe("fixture");
      expect(result.manifest.git.dirty).toBe(true);
    } finally {
      cleanup(root);
    }
  });
});
