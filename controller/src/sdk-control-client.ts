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

type ConnectSession = (options: ConnectOptions) => Promise<Session>;

const DEFAULT_CONNECT_TIMEOUT_MS = 300_000;
const DEFAULT_RETRY_INTERVAL_MS = 1_000;

export class SdkControllerClient implements ControllerClient {
  private session: Session | undefined;
  private readonly jobs = new Map<string, JobHandle>();

  constructor(
    private readonly url: string,
    private readonly connectSession: ConnectSession = connect,
  ) {}

  async connect(options: ControllerConnectOptions = {}): Promise<void> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
    const retryIntervalMs = options.retryIntervalMs ?? DEFAULT_RETRY_INTERVAL_MS;
    const deadline = Date.now() + timeoutMs;

    for (;;) {
      try {
        this.session = await this.connectSession({ url: this.url });
        return;
      } catch (error) {
        if (Date.now() >= deadline) throw wrapError(error);
        if (retryIntervalMs > 0) await Bun.sleep(retryIntervalMs);
      }
    }
  }

  async describeCommands(): Promise<ControlCommandDescriptor[]> {
    try {
      const commands = await this.requireSession().listCommands();
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
      const result = await this.requireSession().run<Record<string, unknown>>(name, args, {
        ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
      });
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
      const handle = await this.requireSession().run<Record<string, unknown>>(name, args, {
        wait: false,
        ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
      });
      this.jobs.set(handle.jobId, handle);
      return { jobId: handle.jobId, state: "running" };
    } catch (error) {
      throw wrapError(error);
    }
  }

  async jobStatus(jobId: string): Promise<JobPollResult> {
    const handle = this.jobs.get(jobId);
    if (!handle) throw unknownJobError(jobId);

    try {
      const result = await handle.result<Record<string, unknown>>();
      this.jobs.delete(jobId);
      return toCommandResult(result);
    } catch (error) {
      this.jobs.delete(jobId);
      throw wrapError(error);
    }
  }

  async cancelJob(jobId: string): Promise<JobCancelResult> {
    const handle = this.jobs.get(jobId);
    if (!handle) return { accepted: false, state: "unknown" };

    try {
      const result = await handle.cancel();
      this.jobs.delete(jobId);
      return { accepted: result.accepted, state: result.state };
    } catch (error) {
      this.jobs.delete(jobId);
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
