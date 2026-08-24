import { resolve } from "node:path";
import type {
  CommandAccepted,
  CommandResult,
  ControlCommandDescriptor,
  JobCancelResult,
  JobPollResult,
} from "./control-types";
import { validateSnapshot } from "./validate-snapshot";
import { waitForWorld } from "./wait-for-world";

export interface ControllerConnectOptions {
  timeoutMs?: number;
  retryIntervalMs?: number;
}

export interface ControllerCallOptions {
  timeoutMs?: number;
}

export interface ControllerClient {
  connect(options?: ControllerConnectOptions): Promise<void>;
  describeCommands(options?: ControllerCallOptions): Promise<ControlCommandDescriptor[]>;
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
  jobStatus(jobId: string, options?: ControllerCallOptions): Promise<JobPollResult>;
  cancelJob(jobId: string, options?: ControllerCallOptions): Promise<JobCancelResult>;
  close(): Promise<void>;
}

export interface ExportEvent {
  phase: string;
  status: string;
  [key: string]: unknown;
}

export interface HotReplProcess {
  pid: number;
  name: string;
}

export type ListHotReplProcesses = (port: number) => Promise<HotReplProcess[]>;

export interface ExportOptions {
  client: ControllerClient;
  /** The WebSocket URL that identifies the HotRepl session. */
  url: string;
  listHotReplProcesses?: ListHotReplProcesses;
  outputBaseDir: string;
  pipelineOutDir: string;
  runPipeline?: (snapshotDir: string, pipelineOutDir: string) => Promise<void>;
  validate?: (snapshotDir: string) => Promise<{ itemCount: number }>;
  log?: (event: ExportEvent) => void;
  noQuit?: boolean;
  waitForWorld?: boolean;
  waitForWorldTimeoutMs?: number;
  connectTimeoutMs?: number;
  finalizeTimeoutMs?: number;
  jobTimeoutMs?: number;
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

export const CONTROLLER_TIMEOUTS = {
  // A local HotRepl handshake should be available quickly; retries cannot hide a dead port.
  connectMs: 30_000,
  // Command metadata is in-memory and should not take as long as an export operation.
  commandCatalogMs: 10_000,
  // Ordinary control commands perform bounded validation and state changes, not asset writes.
  commandMs: 30_000,
  // Starting an export batch queues work and should return promptly before polling it.
  batchStartMs: 30_000,
  // One job-status request may include a short SDK poll; the orchestrator owns the total limit.
  jobPollMs: 5_000,
  // A batch can traverse many Unity objects, but a stuck job must fail within five minutes.
  jobMs: 300_000,
  // Finalization writes and hashes the complete snapshot, so it is intentionally generous.
  finalizeMs: 300_000,
  // Loading the world can involve scene/menu transitions and is bounded to one minute.
  waitForWorldMs: 60_000,
  // Retry pacing avoids a busy loop while waiting for the game to expose its socket.
  retryIntervalMs: 1_000,
} as const;

/**
 * The Unity product name the mod must report from `compendium.preflight`.
 *
 * Deliberately hardcoded rather than configurable: its whole purpose is to fail
 * loudly when the controller has attached to a different HotRepl-instrumented
 * game, which happens when two of them claim the same port.
 */
const EXPECTED_PRODUCT_NAME = "Ardenfall Demo 2025";

export async function exportCompendium(options: ExportOptions): Promise<ExportResult> {
  const log = options.log ?? (() => undefined);
  const outputBaseDir = toRuntimePath(resolve(options.outputBaseDir));
  const connectTimeoutMs = options.connectTimeoutMs ?? CONTROLLER_TIMEOUTS.connectMs;
  if (options.url !== undefined) {
    const port = readHotReplPort(options.url);
    const processes = await (options.listHotReplProcesses ?? listHotReplProcesses)(port);
    assertSingleHotReplProcess(port, processes);
    log({ phase: "portPreflight", status: "completed", port, processes });
  }
  await options.client.connect({
    timeoutMs: connectTimeoutMs,
  });
  log({ phase: "connect", status: "completed" });

  const shouldWaitForWorld = options.waitForWorld === true;
  const availableCommands = assertRequiredCommands(
    await options.client.describeCommands({
      timeoutMs: options.connectTimeoutMs ?? CONTROLLER_TIMEOUTS.commandCatalogMs,
    }),
    options.noQuit === true,
    shouldWaitForWorld,
  );

  if (shouldWaitForWorld) {
    await waitForWorld(
      {
        call: async (name, args) => {
          const result = await options.client.call(name, args, {
            timeoutMs: CONTROLLER_TIMEOUTS.commandMs,
          });
          if (name === "compendium.preflight") assertExpectedProductName(result.output);
          return result;
        },
      },
      { timeoutMs: options.waitForWorldTimeoutMs ?? CONTROLLER_TIMEOUTS.waitForWorldMs },
    );
    log({ phase: "waitForWorld", status: "completed" });
  } else {
    const preflight = await options.client.call(
      "compendium.preflight",
      {},
      { timeoutMs: CONTROLLER_TIMEOUTS.commandMs },
    );
    assertExpectedProductName(preflight.output);
    if (preflight.output.ready !== true) throw new Error(formatPreflightFailure(preflight.output));
  }
  log({ phase: "preflight", status: "completed" });

  const begin = await options.client.call(
    "run.begin",
    { outputBaseDir },
    { timeoutMs: CONTROLLER_TIMEOUTS.commandMs },
  );
  const runId = requireString(begin.output.runId, "run.begin output.runId");
  log({ phase: "run", status: "begun", runId });

  let succeeded = false;
  let activeJobId: string | undefined;
  try {
    const plan = await options.client.call(
      "entity.plan",
      { runId, entity: "item" },
      { timeoutMs: CONTROLLER_TIMEOUTS.commandMs },
    );
    const total = requireNumber(plan.output.total, "entity.plan output.total");
    const batchSize = requireNumber(plan.output.batchSize, "entity.plan output.batchSize");
    for (let offset = 0; offset < total; offset += batchSize) {
      const accepted = await options.client.startJob(
        "entity.exportBatch",
        {
          runId,
          entity: "item",
          offset,
          limit: batchSize,
        },
        { timeoutMs: CONTROLLER_TIMEOUTS.batchStartMs },
      );
      activeJobId = accepted.jobId;
      await waitForJob(options.client, accepted.jobId, options.jobTimeoutMs);
      activeJobId = undefined;
      log({ phase: "entity.exportBatch", status: "completed", runId, offset });
    }

    log({ phase: "run.finalize", status: "started", runId });

    const finalized = await options.client.call(
      "run.finalize",
      { runId },
      { timeoutMs: options.finalizeTimeoutMs ?? CONTROLLER_TIMEOUTS.finalizeMs },
    );

    const publishedDir = normalizeControllerPath(
      requireString(finalized.output.publishedDir, "run.finalize output.publishedDir"),
    );
    log({
      phase: "run.finalize",
      status: "completed",
      runId,
      publishedDir,
      timings: finalized.output.timings,
    });

    const validate = options.validate ?? validateSnapshot;
    log({ phase: "validate", status: "started", publishedDir });
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

    succeeded = true;
    return { runId, publishedDir };
  } finally {
    if (!succeeded)
      await cleanupFailedRun(options.client, runId, activeJobId, availableCommands, log);
    if (options.noQuit !== true) await quitGame(options.client, log);
  }
}

function assertRequiredCommands(
  commands: ControlCommandDescriptor[],
  noQuit: boolean,
  waitForWorld: boolean,
): Set<string> {
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
  return new Set(byName.keys());
}

async function cleanupFailedRun(
  client: ControllerClient,
  runId: string,
  activeJobId: string | undefined,
  availableCommands: Set<string>,
  log: (event: ExportEvent) => void,
): Promise<void> {
  if (activeJobId !== undefined) {
    log({ phase: "entity.exportBatch", status: "cancelling", jobId: activeJobId, runId });
    try {
      const result = await client.cancelJob(activeJobId, {
        timeoutMs: CONTROLLER_TIMEOUTS.commandMs,
      });
      log({
        phase: "entity.exportBatch",
        status: result.accepted ? "cancelled" : "cancel-rejected",
        jobId: activeJobId,
        runId,
        state: result.state,
      });
    } catch (error) {
      log({
        phase: "entity.exportBatch",
        status: "cancel-failed",
        jobId: activeJobId,
        runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (!availableCommands.has("run.discard")) {
    log({
      phase: "run.discard",
      status: "unavailable",
      runId,
      error: "HotRepl peer does not expose run.discard; run state could not be discarded.",
    });
    return;
  }

  log({ phase: "run.discard", status: "started", runId });
  try {
    await client.call("run.discard", { runId }, { timeoutMs: CONTROLLER_TIMEOUTS.commandMs });
    log({ phase: "run.discard", status: "completed", runId });
  } catch (error) {
    log({
      phase: "run.discard",
      status: "failed",
      runId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function quitGame(
  client: ControllerClient,
  log: (event: ExportEvent) => void,
): Promise<void> {
  try {
    await client.call("game.quit", {}, { timeoutMs: CONTROLLER_TIMEOUTS.commandMs });
    log({ phase: "game.quit", status: "completed" });
  } catch (error) {
    log({
      phase: "game.quit",
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function waitForJob(
  client: ControllerClient,
  jobId: string,
  timeoutMs: number = CONTROLLER_TIMEOUTS.jobMs,
): Promise<CommandResult> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for job ${jobId}.`);
    const status = await client.jobStatus(jobId, { timeoutMs: CONTROLLER_TIMEOUTS.jobPollMs });
    if (isCommandResult(status)) return status;
    if (status.state === "failed" || status.state === "cancelled")
      throw new Error(`Job ${jobId} ended in state ${status.state}`);
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) throw new Error(`Timed out waiting for job ${jobId}.`);
    await Bun.sleep(Math.min(250, remainingMs));
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

function readHotReplPort(url: string): number {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (error) {
    throw new Error(`HotRepl URL is invalid and has no readable port: ${url}`, { cause: error });
  }
  if (parsed.port.length === 0)
    throw new Error(`HotRepl URL must include an explicit port: ${url}`);
  const port = Number(parsed.port);
  if (!Number.isInteger(port) || port < 1 || port > 65_535)
    throw new Error(`HotRepl URL has an invalid port ${parsed.port}: ${url}`);
  return port;
}

async function listHotReplProcesses(port: number): Promise<HotReplProcess[]> {
  let processList: Bun.Subprocess<"ignore", "pipe", "pipe">;
  try {
    processList = Bun.spawn(["lsof", "-nP", "-a", `-iTCP:${port}`, "-sTCP:LISTEN", "-Fpcn"], {
      stdout: "pipe",
      stderr: "pipe",
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read the process list for HotRepl port ${port}: ${reason}`, {
      cause: error,
    });
  }
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(processList.stdout).text(),
    new Response(processList.stderr).text(),
    processList.exited,
  ]);
  if (
    exitCode !== 0 &&
    !(exitCode === 1 && stdout.trim().length === 0 && stderr.trim().length === 0)
  ) {
    const detail = stderr.trim().length > 0 ? `: ${stderr.trim()}` : "";
    throw new Error(
      `Unable to read the process list for HotRepl port ${port}: lsof exited ${exitCode}${detail}`,
    );
  }
  return parseLsofProcesses(stdout, port);
}

function parseLsofProcesses(output: string, port: number): HotReplProcess[] {
  const processes = new Map<number, HotReplProcess>();
  let pid: number | undefined;
  let name = "<unknown>";
  for (const line of output.split("\n")) {
    if (line.startsWith("p")) {
      const value = Number(line.slice(1));
      if (!Number.isInteger(value) || value < 1)
        throw new Error(`Unable to read the process list for HotRepl port ${port}: invalid PID`);
      pid = value;
      name = "<unknown>";
    } else if (line.startsWith("c")) {
      name = line.slice(1) || "<unknown>";
    } else if (line.startsWith("n") && pid !== undefined) {
      processes.set(pid, { pid, name });
    }
  }
  return [...processes.values()];
}

function assertSingleHotReplProcess(port: number, processes: HotReplProcess[]): void {
  if (processes.length === 0)
    throw new Error(`No process holds HotRepl port ${port}; cannot prove which game answered.`);
  if (processes.length > 1) {
    const names = processes.map(({ name, pid }) => `${name} (pid ${pid})`).join(", ");
    throw new Error(`HotRepl port ${port} is held by multiple processes: ${names}`);
  }
}

function normalizeControllerPath(path: string): string {
  const normalized = path.replaceAll("\\", "/");
  return normalized.replace(/^z:\//i, "/");
}

function toRuntimePath(path: string): string {
  if (!path.startsWith("/")) return path;
  return `Z:${path.replaceAll("/", "\\")}`;
}

function assertExpectedProductName(result: Record<string, unknown>): void {
  const actual = typeof result.productName === "string" ? result.productName : "<missing>";
  if (actual !== EXPECTED_PRODUCT_NAME) {
    throw new Error(
      `Publication embargo: expected Unity product name "${EXPECTED_PRODUCT_NAME}", ` +
        `but HotRepl reported "${actual}". This usually indicates a port collision with ` +
        "another instrumented game. Content from that install must not be published; stop it and " +
        "reconnect to Ardenfall Demo before exporting.",
    );
  }
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

function isCommandResult(value: JobPollResult): value is CommandResult {
  return "output" in value;
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
