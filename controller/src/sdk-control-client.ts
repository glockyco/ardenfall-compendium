import {
  connect,
  HotReplError,
  type ConnectOptions,
  type JobHandle,
  type Result,
  type Session,
} from "@hotrepl/sdk";
import type {
  ArtifactMap,
  CommandAccepted,
  CommandResult,
  ControlCommandDescriptor,
  JobCancelResult,
  JobPollResult,
} from "./control-types";
import { ControlCommandError } from "./control-types";
import type {
  ControllerCallOptions,
  ControllerClient,
  ControllerConnectOptions,
} from "./export-orchestrator";
import { CONTROLLER_TIMEOUTS } from "./export-orchestrator";

type ConnectSession = (options: ConnectOptions) => Promise<Session>;

export class SdkControllerClient implements ControllerClient {
  private session: Session | undefined;
  private readonly jobs = new Map<string, JobHandle>();

  constructor(
    private readonly url: string,
    private readonly connectSession: ConnectSession = connect,
  ) {}

  async connect(options: ControllerConnectOptions = {}): Promise<void> {
    const timeoutMs = options.timeoutMs ?? CONTROLLER_TIMEOUTS.connectMs;
    const retryIntervalMs = options.retryIntervalMs ?? CONTROLLER_TIMEOUTS.retryIntervalMs;
    const deadline = Date.now() + timeoutMs;

    for (;;) {
      try {
        this.session = await withTimeout(
          this.connectSession({ url: this.url }),
          Math.max(1, deadline - Date.now()),
          "HotRepl connection",
        );
        return;
      } catch (error) {
        if (Date.now() >= deadline) throw wrapError(error);
        if (retryIntervalMs > 0) await Bun.sleep(retryIntervalMs);
      }
    }
  }

  async describeCommands(options: ControllerCallOptions = {}): Promise<ControlCommandDescriptor[]> {
    try {
      const commands = await withTimeout(
        this.requireSession().listCommands(),
        options.timeoutMs ?? CONTROLLER_TIMEOUTS.commandCatalogMs,
        "HotRepl command catalog",
      );
      return commands.map((command) => ({
        name: command.name,
        version: command.majorVersion,
        kind: command.kind,
        mutatesState: command.mutatesState,
      }));
    } catch (error) {
      throw wrapError(error);
    }
  }

  async call(
    name: string,
    args: Record<string, unknown>,
    options: ControllerCallOptions = {},
  ): Promise<CommandResult> {
    try {
      const timeoutMs = options.timeoutMs ?? CONTROLLER_TIMEOUTS.commandMs;
      const result = await withTimeout(
        this.requireSession().run<Record<string, unknown>>(name, args, { timeoutMs }),
        timeoutMs,
        `HotRepl command '${name}'`,
      );
      return toCommandResult(result);
    } catch (error) {
      throw wrapError(error);
    }
  }

  async startJob(
    name: string,
    args: Record<string, unknown>,
    options: ControllerCallOptions = {},
  ): Promise<CommandAccepted> {
    try {
      const timeoutMs = options.timeoutMs ?? CONTROLLER_TIMEOUTS.batchStartMs;
      const handle = await withTimeout(
        this.requireSession().run<Record<string, unknown>>(name, args, {
          wait: false,
          timeoutMs,
        }),
        timeoutMs,
        `HotRepl job '${name}' start`,
      );
      this.jobs.set(handle.jobId, handle);
      return { jobId: handle.jobId, state: "running" };
    } catch (error) {
      throw wrapError(error);
    }
  }

  async jobStatus(jobId: string, options: ControllerCallOptions = {}): Promise<JobPollResult> {
    const handle = this.jobs.get(jobId);
    if (!handle) throw unknownJobError(jobId);

    try {
      const result = await withTimeout(
        handle.result<Record<string, unknown>>(),
        options.timeoutMs ?? CONTROLLER_TIMEOUTS.jobPollMs,
        `HotRepl job '${jobId}' status`,
      );
      this.jobs.delete(jobId);
      return toCommandResult(result);
    } catch (error) {
      if (!(error instanceof OperationTimeoutError)) this.jobs.delete(jobId);
      throw wrapError(error);
    }
  }

  async cancelJob(jobId: string, options: ControllerCallOptions = {}): Promise<JobCancelResult> {
    const handle = this.jobs.get(jobId);
    if (!handle) return { accepted: false, state: "unknown" };

    try {
      const result = await withTimeout(
        handle.cancel(),
        options.timeoutMs ?? CONTROLLER_TIMEOUTS.commandMs,
        `HotRepl job '${jobId}' cancellation`,
      );
      this.jobs.delete(jobId);
      return { accepted: result.accepted, state: result.state };
    } catch (error) {
      if (!(error instanceof OperationTimeoutError)) this.jobs.delete(jobId);
      throw wrapError(error);
    }
  }

  async close(): Promise<void> {
    this.session?.close();
    this.session = undefined;
    this.jobs.clear();
  }

  private requireSession(): Session {
    if (this.session) return this.session;
    throw new ControlCommandError({
      kind: "invalid_request",
      code: "notConnected",
      message: "HotRepl controller client is not connected.",
      retryable: false,
    });
  }
}

function withTimeout<T>(operation: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new OperationTimeoutError(label, timeoutMs)), timeoutMs);
    operation.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

class OperationTimeoutError extends Error {
  constructor(label: string, timeoutMs: number) {
    super(`${label} timed out after ${timeoutMs} ms.`);
    this.name = "OperationTimeoutError";
  }
}

function toCommandResult(result: Result<Record<string, unknown>>): CommandResult {
  return { status: "ok", output: result.output, artifacts: toArtifactMap(result.artifacts) };
}

function toArtifactMap(artifacts: Result["artifacts"]): ArtifactMap {
  const mapped: ArtifactMap = {};
  for (const [logicalName, artifact] of Object.entries(artifacts)) {
    const ref = artifact.ref;
    mapped[logicalName] = {
      logicalName,
      uri: ref.uri,
      contentType: ref.contentType,
      byteSize: ref.byteSize,
      sha256: ref.sha256,
      finalized: ref.finalized,
      ...(ref.path === undefined ? {} : { path: ref.path }),
    };
  }
  return mapped;
}

function wrapError(error: unknown): unknown {
  if (!(error instanceof HotReplError)) return error;
  return new ControlCommandError({
    kind: error.kind,
    code: error.code,
    message: error.message,
    retryable: error.retryable,
    ...(error.details === undefined ? {} : { details: error.details }),
  });
}

function unknownJobError(jobId: string): ControlCommandError {
  return new ControlCommandError({
    kind: "invalid_request",
    code: "unknownJob",
    message: `Unknown HotRepl job '${jobId}'.`,
    retryable: false,
  });
}
