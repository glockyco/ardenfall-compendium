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
  return { name, version: 1, kind, mutatesState };
}

class FakeClient implements ControllerClient {
  readonly calls: Array<{
    name: string;
    args: Record<string, unknown>;
    options?: Record<string, unknown>;
  }> = [];
  readonly jobs: Array<{ name: string; args: Record<string, unknown> }> = [];
  readonly jobPolls: string[] = [];
  describeOptions: Record<string, unknown> | undefined;
  commands = [
    command("compendium.preflight"),
    command("compendium.continueFromMenu", "sync", true),
    command("run.begin", "sync", true),
    command("entity.plan"),
    command("entity.exportBatch", "job", true),
    command("run.finalize", "sync", true),
    command("game.quit", "sync", true),
  ];
  preflightResult: Record<string, unknown> = {
    ready: true,
    productName: "Ardenfall Demo 2025",
    gameVersion: "0.0.10.91",
  };
  preflightResults: Record<string, unknown>[] = [];
  publishedDir = "/tmp/snapshot";

  finalizeError: Error | null = null;
  async connect() {}
  async describeCommands(options?: Record<string, unknown>) {
    this.describeOptions = options;
    return this.commands;
  }
  async call(name: string, args: Record<string, unknown>, options?: Record<string, unknown>) {
    this.calls.push({
      name,
      args,
      ...(options === undefined ? {} : { options }),
    });
    if (name === "compendium.preflight") {
      const output = this.preflightResults.shift() ?? this.preflightResult;
      return { status: "ok", output, artifacts: {} };
    }
    if (name === "run.begin")
      return {
        status: "ok",
        output: { runId: "run-1", workspaceDir: "/tmp/run-1" },
        artifacts: {},
      };
    if (name === "entity.plan")
      return {
        status: "ok",
        output: { entity: "item", total: 150, batchSize: 100, batches: 2 },
        artifacts: {},
      };
    if (name === "compendium.continueFromMenu")
      return {
        status: "ok",
        output: { clicked: true },
        artifacts: {},
      };
    if (name === "game.quit")
      return {
        status: "ok",
        output: {},
        artifacts: {},
      };
    if (name === "run.finalize") {
      if (this.finalizeError) throw this.finalizeError;
      return {
        status: "ok",
        output: {
          runId: "run-1",
          publishedDir: this.publishedDir,
          timings: [{ phase: "publish", elapsedMs: 3 }],
        },
        artifacts: {},
      };
    }
    throw new Error(`unexpected call ${name}`);
  }
  async startJob(name: string, args: Record<string, unknown>) {
    this.jobs.push({ name, args });
    return { jobId: `job-${this.jobs.length}`, state: "running" };
  }
  async jobStatus(jobId: string) {
    this.jobPolls.push(jobId);
    return { status: "ok", output: { jobId }, artifacts: {} };
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
    expect(client.jobPolls).toEqual(["job-1", "job-2"]);
    expect(events).toContainEqual(
      expect.objectContaining({ phase: "pipeline", status: "completed" }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({ phase: "run.finalize", status: "started", runId: "run-1" }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        phase: "run.finalize",
        status: "completed",
        runId: "run-1",
        timings: [{ phase: "publish", elapsedMs: 3 }],
      }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        phase: "validate",
        status: "started",
        publishedDir: "/tmp/snapshot",
      }),
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

  it("allows asset-heavy finalization to run longer than ordinary commands", async () => {
    const client = new FakeClient();

    await exportCompendium({
      client,
      outputBaseDir: "/tmp/out",
      pipelineOutDir: "/tmp/pipeline",
      validate: async () => ({ itemCount: 150 }),
      runPipeline: async () => undefined,
    });

    expect(client.calls.find((call) => call.name === "run.finalize")?.options).toEqual({
      timeoutMs: 300_000,
    });
  });

  it("lets initial command catalog readiness use the connect timeout", async () => {
    const client = new FakeClient();

    await exportCompendium({
      client,
      outputBaseDir: "/tmp/out",
      pipelineOutDir: "/tmp/pipeline",
      validate: async () => ({ itemCount: 150 }),
      runPipeline: async () => undefined,
      connectTimeoutMs: 123_000,
    });

    expect(client.describeOptions).toEqual({ timeoutMs: 123_000 });
  });

  it("waits for world by clicking through the main menu before beginning a run", async () => {
    const client = new FakeClient();
    client.preflightResults = [
      {
        ready: false,
        productName: "Ardenfall Demo 2025",
        gameVersion: "0.0.10.91",
        checks: [{ name: "ardenfallGame", ok: false, reason: "ArdenfallGame.instance is null" }],
      },
      {
        ready: true,
        productName: "Ardenfall Demo 2025",
        gameVersion: "0.0.10.91",
        checks: [],
      },
    ];

    await exportCompendium({
      client,
      outputBaseDir: "/tmp/out",
      pipelineOutDir: "/tmp/pipeline",
      validate: async () => ({ itemCount: 150 }),
      runPipeline: async () => undefined,
      waitForWorld: true,
    });

    expect(client.calls.map((call) => call.name).slice(0, 4)).toEqual([
      "compendium.preflight",
      "compendium.continueFromMenu",
      "compendium.preflight",
      "run.begin",
    ]);
  });

  it("surfaces failed preflight check reasons", async () => {
    const client = new FakeClient();
    client.preflightResult = {
      ready: false,
      productName: "Ardenfall Demo 2025",
      gameVersion: "0.0.10.91",
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

  it("refuses to run when preflight identifies a different game", async () => {
    const client = new FakeClient();
    client.preflightResult = {
      ready: true,
      productName: "Vespera",
      gameVersion: "0.9.27.0",
      checks: [],
    };

    await expect(
      exportCompendium({ client, outputBaseDir: "/tmp/out", pipelineOutDir: "/tmp/pipeline" }),
    ).rejects.toThrow(
      /expected Unity product name "Ardenfall Demo 2025".*reported "Vespera".*port collision/i,
    );

    expect(client.calls.map((call) => call.name)).toEqual(["compendium.preflight"]);
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

  it("accepts matching manifest hashes and entity counts for every emitted artifact", async () => {
    const root = await snapshotRoot(roots);
    await writeSnapshot(root);

    await expect(validateSnapshot(root)).resolves.toEqual({
      itemCount: 2,
      counts: {
        item: 2,
        "stat-type": 1,
        "item-category": 1,
        "item-tag": 1,
        location: 1,
        portal: 1,
      },
    });
  });

  it("rejects a semantically empty snapshot", async () => {
    const root = await snapshotRoot(roots);
    await writeSnapshot(root, {
      emptyEntities: ["item", "stat-type", "item-category", "item-tag", "location", "portal"],
    });

    await expect(validateSnapshot(root)).rejects.toThrow(/snapshot contains no items/);
  });

  it("accepts an entity with zero rows when its manifest count matches", async () => {
    const root = await snapshotRoot(roots);
    await writeSnapshot(root, { emptyEntities: ["stat-type"] });

    await expect(validateSnapshot(root)).resolves.toMatchObject({
      itemCount: 2,
      counts: { "stat-type": 0 },
    });
  });

  it("rejects a snapshot with a mismatched item hash", async () => {
    const root = await snapshotRoot(roots);
    await writeSnapshot(root, { itemHash: "bad" });

    await expect(validateSnapshot(root)).rejects.toThrow(/items\.json hash mismatch/);
  });

  it("rejects a snapshot with a missing manifest artifact", async () => {
    const root = await snapshotRoot(roots);
    await writeSnapshot(root, { omitFiles: ["stat-types.json"] });

    await expect(validateSnapshot(root)).rejects.toThrow(/stat-types\.json is missing/);
  });

  it("rejects a snapshot with a missing locations artifact", async () => {
    const root = await snapshotRoot(roots);
    await writeSnapshot(root, { omitFiles: ["locations.json"] });

    await expect(validateSnapshot(root)).rejects.toThrow(/locations\.json is missing/);
  });

  it("rejects a snapshot with a missing portals artifact", async () => {
    const root = await snapshotRoot(roots);
    await writeSnapshot(root, { omitFiles: ["portals.json"] });

    await expect(validateSnapshot(root)).rejects.toThrow(/portals\.json is missing/);
  });

  it("rejects a snapshot with a mismatched non-item hash", async () => {
    const root = await snapshotRoot(roots);
    await writeSnapshot(root, { hashOverrides: { "master-tooltip.json": "bad" } });

    await expect(validateSnapshot(root)).rejects.toThrow(/master-tooltip\.json hash mismatch/);
  });

  it("rejects a snapshot with a mismatched non-item row count", async () => {
    const root = await snapshotRoot(roots);
    await writeSnapshot(root, { countOverrides: { "stat-type": 2 } });

    await expect(validateSnapshot(root)).rejects.toThrow(
      /manifest stat-type count 2 does not match 1 rows/,
    );
  });

  it("rejects malformed diagnostics artifacts", async () => {
    const root = await snapshotRoot(roots);
    await writeSnapshot(root, { diagnosticsText: JSON.stringify({ rows: [] }) });

    await expect(validateSnapshot(root)).rejects.toThrow(/diagnostics\.json must be an array/);
  });

  it("rejects fatal diagnostics", async () => {
    const root = await snapshotRoot(roots);
    await writeSnapshot(root, { fatalDiagnostics: 1 });

    await expect(validateSnapshot(root)).rejects.toThrow(/snapshot contains fatal diagnostics/);
  });

  async function snapshotRoot(roots: string[]) {
    const root = await mkdtemp(join(tmpdir(), "ardenfall-snapshot-"));
    roots.push(root);
    await mkdir(root, { recursive: true });
    return root;
  }

  async function writeSnapshot(
    root: string,
    options: {
      emptyEntities?: string[];
      itemHash?: string;
      hashOverrides?: Record<string, string>;
      countOverrides?: Record<string, number>;
      omitFiles?: string[];
      diagnosticsText?: string;
      fatalDiagnostics?: number;
    } = {},
  ) {
    const emptyEntities = new Set(options.emptyEntities ?? []);
    const files: Record<string, string> = {
      "items.json": JSON.stringify(
        { rows: emptyEntities.has("item") ? [] : [{ id: "item-1" }, { id: "item-2" }] },
        null,
        2,
      ),
      "stat-types.json": JSON.stringify(
        { rows: emptyEntities.has("stat-type") ? [] : [{ id: "stat-strength" }] },
        null,
        2,
      ),
      "item-categories.json": JSON.stringify(
        { rows: emptyEntities.has("item-category") ? [] : [{ id: "category-weapons" }] },
        null,
        2,
      ),
      "item-tags.json": JSON.stringify(
        { rows: emptyEntities.has("item-tag") ? [] : [{ id: "tag-valuable" }] },
        null,
        2,
      ),
      "locations.json": JSON.stringify(
        { rows: emptyEntities.has("location") ? [] : [{ id: "11111111.fixture-town" }] },
        null,
        2,
      ),
      "portals.json": JSON.stringify(
        { rows: emptyEntities.has("portal") ? [] : [{ id: "world;portals;portal-a" }] },
        null,
        2,
      ),
      "asset-manifest.json": JSON.stringify({ assets: [], itemIconMetadata: [] }, null, 2),
      "master-tooltip.json": JSON.stringify({ schemaVersion: 2, tooltipCodes: {} }, null, 2),
    };
    if (options.diagnosticsText !== undefined) files["diagnostics.json"] = options.diagnosticsText;

    const omitted = new Set(options.omitFiles ?? []);
    await Promise.all(
      Object.entries(files)
        .filter(([file]) => !omitted.has(file))
        .map(([file, text]) => writeFile(join(root, file), text)),
    );

    const hashes = Object.fromEntries(
      Object.entries(files).map(([file, text]) => [file, hash(text)]),
    ) as Record<string, string>;
    if (options.itemHash) hashes["items.json"] = options.itemHash;
    for (const [file, value] of Object.entries(options.hashOverrides ?? {})) hashes[file] = value;

    await writeFile(
      join(root, "manifest.json"),
      JSON.stringify(
        {
          counts: {
            item: options.countOverrides?.item ?? (emptyEntities.has("item") ? 0 : 2),
            "stat-type":
              options.countOverrides?.["stat-type"] ?? (emptyEntities.has("stat-type") ? 0 : 1),
            "item-category":
              options.countOverrides?.["item-category"] ??
              (emptyEntities.has("item-category") ? 0 : 1),
            "item-tag":
              options.countOverrides?.["item-tag"] ?? (emptyEntities.has("item-tag") ? 0 : 1),
            location: options.countOverrides?.location ?? (emptyEntities.has("location") ? 0 : 1),
            portal: options.countOverrides?.portal ?? (emptyEntities.has("portal") ? 0 : 1),
          },
          hashes,
          diagnostics: { fatal: options.fatalDiagnostics ?? 0 },
        },
        null,
        2,
      ),
    );
  }

  function hash(text: string) {
    return new Bun.CryptoHasher("sha256").update(text).digest("hex");
  }
});
