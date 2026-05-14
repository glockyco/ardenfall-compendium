import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import {
  buildPipelineCommand,
  exportCompendium,
  type ControllerClient,
} from "../src/export-orchestrator";
import { validateSnapshot } from "../src/validate-snapshot";

function command(name: string, kind: "sync" | "job" = "sync", mutatesState = false) {
  return { name, version: 1, kind, mutatesState, argsSchema: {}, resultSchema: {} };
}

class FakeClient implements ControllerClient {
  readonly calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  readonly jobs: Array<{ name: string; args: Record<string, unknown> }> = [];
  commands = [
    command("compendium.preflight"),
    command("run.begin", "sync", true),
    command("entity.plan"),
    command("entity.exportBatch", "job", true),
    command("run.finalize", "sync", true),
    command("game.quit", "sync", true),
  ];
  preflightResult: Record<string, unknown> = { ready: true };
  publishedDir = "/tmp/snapshot";

  finalizeError: Error | null = null;
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
    if (name === "compendium.preflight")
      return { status: "ok", result: this.preflightResult, artifacts: [], diagnostics: [] };
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
    if (name === "game.quit")
      return {
        status: "ok",
        result: {},
        artifacts: [],
        diagnostics: [],
      };
    if (name === "run.finalize") {
      if (this.finalizeError) throw this.finalizeError;
      return {
        status: "ok",
        result: { runId: "run-1", publishedDir: this.publishedDir },
        artifacts: [],
        diagnostics: [],
      };
    }
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

describe("exportCompendium", () => {
  it("runs required HotRepl commands in order and batches entity export", async () => {
    const client = new FakeClient();
    const events: Array<Record<string, unknown>> = [];

    const result = await exportCompendium({
      client,
      outputBaseDir: "/tmp/out",
      pipelineOutDir: "/tmp/pipeline",
      validate: async () => ({ itemCount: 150 }),
      runPipeline: async () => undefined,
      log: (event) => events.push(event),
    });

    expect(result.publishedDir).toBe("/tmp/snapshot");
    expect(client.calls.map((call) => call.name)).toEqual([
      "compendium.preflight",
      "run.begin",
      "entity.plan",
      "run.finalize",
      "game.quit",
    ]);
    expect(client.jobs.map((job) => job.args)).toEqual([
      { runId: "run-1", entity: "item", offset: 0, limit: 100 },
      { runId: "run-1", entity: "item", offset: 100, limit: 100 },
    ]);
    expect(events).toContainEqual(
      expect.objectContaining({ phase: "pipeline", status: "completed" }),
    );
  });

  it("calls game.quit after a successful export", async () => {
    const client = new FakeClient();

    await exportCompendium({
      client,
      outputBaseDir: "/tmp/out",
      pipelineOutDir: "/tmp/pipeline",
      validate: async () => ({ itemCount: 150 }),
      runPipeline: async () => undefined,
    });

    expect(client.calls.map((call) => call.name).at(-1)).toBe("game.quit");
  });

  it("calls game.quit after finalize failure without masking the original error", async () => {
    const client = new FakeClient();
    client.finalizeError = new Error("finalize failed");

    await expect(
      exportCompendium({
        client,
        outputBaseDir: "/tmp/out",
        pipelineOutDir: "/tmp/pipeline",
        validate: async () => ({ itemCount: 150 }),
        runPipeline: async () => undefined,
      }),
    ).rejects.toThrow("finalize failed");

    expect(client.calls.map((call) => call.name).at(-1)).toBe("game.quit");
  });

  it("surfaces failed preflight check reasons", async () => {
    const client = new FakeClient();
    client.preflightResult = {
      ready: false,
      checks: [
        { name: "ardenfallGame", ok: false, reason: "ArdenfallGame.instance is null" },
        { name: "worldData", ok: false, reason: "ArdenfallGame.instance.worldData is null" },
      ],
    };

    await expect(
      exportCompendium({ client, outputBaseDir: "/tmp/out", pipelineOutDir: "/tmp/pipeline" }),
    ).rejects.toThrow(
      /compendium\.preflight is not ready: ardenfallGame: ArdenfallGame\.instance is null; worldData: ArdenfallGame\.instance\.worldData is null/,
    );
  });

  it("uses absolute output directories and normalizes published paths", async () => {
    const client = new FakeClient();
    client.publishedDir = `Z:${resolve("snapshots").replaceAll("/", "\\")}\\snapshots\\0.0.10.91-20260507`;
    const validated: string[] = [];

    const result = await exportCompendium({
      client,
      outputBaseDir: "./snapshots",
      pipelineOutDir: "/tmp/pipeline",
      validate: async (snapshotDir) => {
        validated.push(snapshotDir);
        return { itemCount: 900 };
      },
      runPipeline: async () => undefined,
    });

    expect(client.calls.find((call) => call.name === "run.begin")?.args.outputBaseDir).toBe(
      `Z:${resolve("./snapshots").replaceAll("/", "\\")}`,
    );
    expect(validated).toEqual([`${resolve("snapshots")}/snapshots/0.0.10.91-20260507`]);
    expect(result.publishedDir).toBe(`${resolve("snapshots")}/snapshots/0.0.10.91-20260507`);
  });
  it("refuses to run when a required command is missing", async () => {
    const client = new FakeClient();
    client.commands = client.commands.filter((descriptor) => descriptor.name !== "run.finalize");

    await expect(
      exportCompendium({ client, outputBaseDir: "/tmp/out", pipelineOutDir: "/tmp/pipeline" }),
    ).rejects.toThrow(/Missing required HotRepl command: run\.finalize/);
  });

  it("builds the pipeline command expected by pipeline/src/cli.ts", () => {
    expect(buildPipelineCommand("/snapshot", "/out")).toEqual([
      "bun",
      "run",
      "pipeline:run",
      "/snapshot",
      "/out",
    ]);
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
