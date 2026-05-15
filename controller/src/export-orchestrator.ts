import { resolve } from "node:path";
import type {
  CommandAccepted,
  CommandResult,
  ControlCommandDescriptor,
  HotReplClient,
  JobCancelResult,
  JobStatus,
} from "./hotrepl-client";
import { validateSnapshot } from "./validate-snapshot";
import { waitForWorld } from "./wait-for-world";

export interface ControllerConnectOptions {
  timeoutMs?: number;
  retryIntervalMs?: number;
}

export interface ControllerCallOptions {
  timeoutMs?: number;
  idempotencyKey?: string;
}

export interface ControllerClient {
  connect(options?: ControllerConnectOptions): Promise<void>;
  authenticate(token?: string): Promise<{ ok: boolean; sessionId?: string }>;
  acquireLease(clientName: string): Promise<{ ok: boolean; leaseId?: string }>;
  describeCommands(): Promise<ControlCommandDescriptor[]>;
  call(
    name: string,
    args: Record<string, unknown>,
    options?: ControllerCallOptions,
  ): Promise<CommandResult>;
  startJob(
    name: string,
    args: Record<string, unknown>,
    options?: ControllerCallOptions,
  ): Promise<CommandAccepted>;
  jobStatus(jobId: string): Promise<JobStatus>;
  jobResult(jobId: string): Promise<CommandResult>;
  cancelJob(jobId: string): Promise<JobCancelResult>;
  close(): Promise<void>;
}

export interface ExportEvent {
  phase: string;
  status: string;
  [key: string]: unknown;
}

export interface ExportOptions {
  client: ControllerClient | HotReplClient;
  outputBaseDir: string;
  pipelineOutDir: string;
  token?: string;
  clientName?: string;
  runPipeline?: (snapshotDir: string, pipelineOutDir: string) => Promise<void>;
  validate?: (snapshotDir: string) => Promise<{ itemCount: number }>;
  log?: (event: ExportEvent) => void;
  noQuit?: boolean;
  waitForWorld?: boolean;
  waitForWorldTimeoutMs?: number;
  connectTimeoutMs?: number;
  finalizeTimeoutMs?: number;
}

export interface ExportResult {
  runId: string;
  publishedDir: string;
}

const REQUIRED_COMMANDS = new Map<string, "sync" | "job">([
  ["compendium.preflight", "sync"],
  ["compendium.continueFromMenu", "sync"],
  ["run.begin", "sync"],
  ["entity.plan", "sync"],
  ["entity.exportBatch", "job"],
  ["run.finalize", "sync"],
  ["game.quit", "sync"],
]);

const DEFAULT_CONNECT_TIMEOUT_MS = 300_000;
const DEFAULT_FINALIZE_TIMEOUT_MS = 300_000;

export async function exportCompendium(options: ExportOptions): Promise<ExportResult> {
  const log = options.log ?? (() => undefined);
  const clientName = options.clientName ?? "ardenfall-controller";
  const outputBaseDir = toRuntimePath(resolve(options.outputBaseDir));
  await options.client.connect({
    timeoutMs: options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS,
  });
  log({ phase: "connect", status: "completed" });

  const auth = await options.client.authenticate(options.token);
  if (!auth.ok) throw new Error("HotRepl authentication failed");
  const lease = await options.client.acquireLease(clientName);
  if (!lease.ok) throw new Error("HotRepl lease acquisition failed");
  log({ phase: "lease", status: "completed" });

  const shouldWaitForWorld = options.waitForWorld === true;
  assertRequiredCommands(
    await options.client.describeCommands(),
    options.noQuit === true,
    shouldWaitForWorld,
  );

  if (shouldWaitForWorld) {
    await waitForWorld(options.client, { timeoutMs: options.waitForWorldTimeoutMs ?? 60_000 });
    log({ phase: "waitForWorld", status: "completed" });
  } else {
    const preflight = await options.client.call("compendium.preflight", {});
    if (preflight.result.ready !== true) throw new Error(formatPreflightFailure(preflight.result));
  }
  log({ phase: "preflight", status: "completed" });

  const begin = await options.client.call("run.begin", { outputBaseDir });
  const runId = requireString(begin.result.runId, "run.begin result.runId");
  log({ phase: "run", status: "begun", runId });

  try {
    const plan = await options.client.call("entity.plan", { runId, entity: "item" });
    const total = requireNumber(plan.result.total, "entity.plan result.total");
    const batchSize = requireNumber(plan.result.batchSize, "entity.plan result.batchSize");
    for (let offset = 0; offset < total; offset += batchSize) {
      const accepted = await options.client.startJob("entity.exportBatch", {
        runId,
        entity: "item",
        offset,
        limit: batchSize,
      });
      await waitForJob(options.client, accepted.jobId);
      await options.client.jobResult(accepted.jobId);
      log({ phase: "entity.exportBatch", status: "completed", runId, offset });
    }

    const finalized = await options.client.call(
      "run.finalize",
      { runId },
      { timeoutMs: options.finalizeTimeoutMs ?? DEFAULT_FINALIZE_TIMEOUT_MS },
    );

    const publishedDir = normalizeControllerPath(
      requireString(finalized.result.publishedDir, "run.finalize result.publishedDir"),
    );
    const validate = options.validate ?? validateSnapshot;
    await validate(publishedDir);
    log({ phase: "validate", status: "completed", publishedDir });

    if (options.runPipeline) await options.runPipeline(publishedDir, options.pipelineOutDir);
    else await runPipeline(publishedDir, options.pipelineOutDir);
    log({
      phase: "pipeline",
      status: "completed",
      publishedDir,
      pipelineOutDir: options.pipelineOutDir,
    });

    return { runId, publishedDir };
  } finally {
    if (options.noQuit !== true) await quitGame(options.client, log);
  }
}

function assertRequiredCommands(
  commands: ControlCommandDescriptor[],
  noQuit: boolean,
  waitForWorld: boolean,
): void {
  const byName = new Map(commands.map((command) => [command.name, command]));
  for (const [name, kind] of REQUIRED_COMMANDS) {
    if (noQuit && name === "game.quit") continue;
    if (!waitForWorld && name === "compendium.continueFromMenu") continue;
    const command = byName.get(name);
    if (!command) throw new Error(`Missing required HotRepl command: ${name}`);
    if (command.version !== 1)
      throw new Error(`Unsupported ${name} version ${command.version}; expected 1`);
    if (command.kind !== kind)
      throw new Error(`Unsupported ${name} kind ${command.kind}; expected ${kind}`);
  }
}

async function quitGame(
  client: ControllerClient | HotReplClient,
  log: (event: ExportEvent) => void,
): Promise<void> {
  try {
    await client.call("game.quit", {});
    log({ phase: "game.quit", status: "completed" });
  } catch (error) {
    log({
      phase: "game.quit",
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
async function waitForJob(client: ControllerClient | HotReplClient, jobId: string): Promise<void> {
  for (;;) {
    const status = await client.jobStatus(jobId);
    if (status.state === "completed") return;
    if (status.state === "failed" || status.state === "cancelled")
      throw new Error(`Job ${jobId} ended in state ${status.state}`);
    await Bun.sleep(250);
  }
}

export function buildPipelineCommand(snapshotDir: string, pipelineOutDir: string): string[] {
  return ["bun", "run", "pipeline:run", snapshotDir, pipelineOutDir];
}

async function runPipeline(snapshotDir: string, pipelineOutDir: string): Promise<void> {
  const proc = Bun.spawn(buildPipelineCommand(snapshotDir, pipelineOutDir), {
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) throw new Error(`pipeline:run exited ${exitCode}`);
}

function normalizeControllerPath(path: string): string {
  const normalized = path.replaceAll("\\", "/");
  return normalized.replace(/^z:\//i, "/");
}

function toRuntimePath(path: string): string {
  if (!path.startsWith("/")) return path;
  return `Z:${path.replaceAll("/", "\\")}`;
}

function formatPreflightFailure(result: Record<string, unknown>): string {
  const checks = Array.isArray(result.checks) ? result.checks : [];
  const failedChecks = checks
    .filter((check): check is Record<string, unknown> => isObject(check) && check.ok !== true)
    .map((check) => {
      const name = typeof check.name === "string" && check.name.length > 0 ? check.name : "unknown";
      const reason =
        typeof check.reason === "string" && check.reason.length > 0 ? check.reason : "failed";
      return `${name}: ${reason}`;
    });

  if (failedChecks.length === 0) return "compendium.preflight is not ready";
  return `compendium.preflight is not ready: ${failedChecks.join("; ")}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0)
    throw new Error(`${label} must be a non-empty string`);
  return value;
}

function requireNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error(`${label} must be a finite number`);
  return value;
}
