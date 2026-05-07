import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "bun:test";
import { exportArchive, type ControllerClient } from "../src/export-orchestrator";
import { validateSnapshot } from "../src/validate-snapshot";

function command(name: string, kind: "sync" | "job" = "sync", mutatesState = false) {
  return { name, version: 1, kind, mutatesState, argsSchema: {}, resultSchema: {} };
}

class FakeClient implements ControllerClient {
  readonly calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  readonly jobs: Array<{ name: string; args: Record<string, unknown> }> = [];
  commands = [
    command("archive.preflight"),
    command("run.begin", "sync", true),
    command("entity.plan"),
    command("entity.exportBatch", "job", true),
    command("run.finalize", "sync", true),
  ];

  async connect() {}
  async authenticate() {
    return { ok: true, sessionId: "session-1" };
  }
  async acquireLease() {
    return { ok: true, leaseId: "lease-1" };
  }
  async describeCommands() {
    return this.commands;
  }
  async call(name: string, args: Record<string, unknown>) {
    this.calls.push({ name, args });
    if (name === "archive.preflight")
      return { status: "ok", result: { ready: true }, artifacts: [], diagnostics: [] };
    if (name === "run.begin")
      return {
        status: "ok",
        result: { runId: "run-1", workspaceDir: "/tmp/run-1" },
        artifacts: [],
        diagnostics: [],
      };
    if (name === "entity.plan")
      return {
        status: "ok",
        result: { entity: "item", total: 150, batchSize: 100, batches: 2 },
        artifacts: [],
        diagnostics: [],
      };
    if (name === "run.finalize")
      return {
        status: "ok",
        result: { runId: "run-1", publishedDir: "/tmp/snapshot" },
        artifacts: [],
        diagnostics: [],
      };
    throw new Error(`unexpected call ${name}`);
  }
  async startJob(name: string, args: Record<string, unknown>) {
    this.jobs.push({ name, args });
    return { jobId: `job-${this.jobs.length}`, state: "accepted" };
  }
  async jobStatus(jobId: string) {
    return { jobId, state: "completed" };
  }
  async jobResult(jobId: string) {
    return { status: "ok", result: { jobId }, artifacts: [], diagnostics: [] };
  }
  async cancelJob() {
    return { accepted: true, state: "cancelling" };
  }
  async close() {}
}

describe("exportArchive", () => {
  it("runs required HotRepl commands in order and batches entity export", async () => {
    const client = new FakeClient();
    const events: Array<Record<string, unknown>> = [];

    const result = await exportArchive({
      client,
      outputBaseDir: "/tmp/out",
      pipelineOutDir: "/tmp/pipeline",
      validate: async () => ({ itemCount: 150 }),
      runPipeline: async () => undefined,
      log: (event) => events.push(event),
    });

    expect(result.publishedDir).toBe("/tmp/snapshot");
    expect(client.calls.map((call) => call.name)).toEqual([
      "archive.preflight",
      "run.begin",
      "entity.plan",
      "run.finalize",
    ]);
    expect(client.jobs.map((job) => job.args)).toEqual([
      { runId: "run-1", entity: "item", offset: 0, limit: 100 },
      { runId: "run-1", entity: "item", offset: 100, limit: 100 },
    ]);
    expect(events.at(-1)).toMatchObject({ phase: "pipeline", status: "completed" });
  });

  it("refuses to run when a required command is missing", async () => {
    const client = new FakeClient();
    client.commands = client.commands.filter((descriptor) => descriptor.name !== "run.finalize");

    await expect(
      exportArchive({ client, outputBaseDir: "/tmp/out", pipelineOutDir: "/tmp/pipeline" }),
    ).rejects.toThrow(/Missing required HotRepl command: run\.finalize/);
  });
});

describe("validateSnapshot", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  it("accepts matching manifest hashes and item counts", async () => {
    const root = await mkdtemp(join(tmpdir(), "ardenfall-snapshot-"));
    roots.push(root);
    await mkdir(root, { recursive: true });
    const items = JSON.stringify({ rows: [{ id: "item-1" }, { id: "item-2" }] }, null, 2);
    const hash = new Bun.CryptoHasher("sha256").update(items).digest("hex");
    await writeFile(join(root, "items.json"), items);
    await writeFile(
      join(root, "manifest.json"),
      JSON.stringify(
        { counts: { item: 2 }, hashes: { "items.json": hash }, diagnostics: { fatal: 0 } },
        null,
        2,
      ),
    );

    await expect(validateSnapshot(root)).resolves.toEqual({ itemCount: 2 });
  });

  it("rejects a snapshot with a mismatched item hash", async () => {
    const root = await mkdtemp(join(tmpdir(), "ardenfall-snapshot-"));
    roots.push(root);
    await writeFile(join(root, "items.json"), JSON.stringify({ rows: [] }));
    await writeFile(
      join(root, "manifest.json"),
      JSON.stringify({
        counts: { item: 0 },
        hashes: { "items.json": "bad" },
        diagnostics: { fatal: 0 },
      }),
    );

    await expect(validateSnapshot(root)).rejects.toThrow(/items\.json hash mismatch/);
  });
});
